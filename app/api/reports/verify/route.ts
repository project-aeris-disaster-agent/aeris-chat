export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_DISABLED } from "@/lib/config";
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_MAINNET_NETWORK,
  hashOtpCode,
  hashPhoneNumber,
  normalizePhoneNumber,
  phoneLast4,
} from "@/lib/reports/onchain";

type ServiceClient = NonNullable<Awaited<ReturnType<typeof getServiceClient>>>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body must be an object." }, { status: 400 });
    }

    const value = body as Record<string, unknown>;
    const action = typeof value.action === "string" ? value.action : "";
    const reportId = typeof value.reportId === "string" ? value.reportId : "";
    const anonymousId = typeof value.anonymousId === "string" ? value.anonymousId : undefined;
    const phoneNumber = normalizePhoneNumber(String(value.phoneNumber ?? ""));

    if (!reportId) {
      return NextResponse.json({ error: "reportId is required." }, { status: 400 });
    }
    if (!phoneNumber) {
      return NextResponse.json({ error: "A valid mobile number is required." }, { status: 400 });
    }

    const context = await getReportContext(request, anonymousId);
    if ("response" in context) return context.response;

    const reportResult = await loadOwnedReport(context, reportId);
    if ("response" in reportResult) return reportResult.response;

    if (action === "request") {
      return requestOtp(context.serviceClient, reportResult.report, phoneNumber);
    }

    if (action === "verify") {
      const otpCode = typeof value.otpCode === "string" ? value.otpCode.trim() : "";
      if (!/^\d{6}$/.test(otpCode)) {
        return NextResponse.json({ error: "A 6-digit OTP code is required." }, { status: 400 });
      }

      return verifyOtp(context, reportResult.report, phoneNumber, otpCode);
    }

    return NextResponse.json({ error: "Unsupported verification action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

async function requestOtp(
  serviceClient: ServiceClient,
  report: any,
  phoneNumber: string,
) {
  const devMode = process.env.REPORT_OTP_DEV_MODE === "true";
  const otpCode = devMode ? createOtpCode() : null;
  const metadata = mergeMetadata(report.metadata, {
    phoneVerification: {
      status: "pending",
      phoneLast4: phoneLast4(phoneNumber),
      requestedAt: new Date().toISOString(),
      provider: devMode ? "dev" : "unconfigured",
      otpHash: otpCode ? await hashOtpCode(otpCode, report.id) : undefined,
    },
  });

  const { error } = await serviceClient
    .from("disaster_reports")
    .update({
      phone_verification_status: "pending",
      metadata,
    })
    .eq("id", report.id);

  if (error) return storageError(error);

  return NextResponse.json({
    status: "pending",
    phoneLast4: phoneLast4(phoneNumber),
    otpDelivery: devMode ? "dev" : "not_configured",
    devOtpCode: otpCode ?? undefined,
    message: devMode
      ? "Development OTP generated."
      : "OTP provider is not configured yet. Set REPORT_OTP_DEV_MODE=true for local testing or connect an SMS provider.",
  });
}

async function verifyOtp(
  context: ReportContextReady,
  report: any,
  phoneNumber: string,
  otpCode: string,
) {
  const expectedHash = report.metadata?.phoneVerification?.otpHash;
  if (!expectedHash || expectedHash !== (await hashOtpCode(otpCode, report.id))) {
    return NextResponse.json({ error: "Invalid or expired OTP code." }, { status: 400 });
  }

  const phoneHash = await hashPhoneNumber(phoneNumber);
  const { data: wallet, error: walletError } = await context.serviceClient
    .from("report_proxy_wallets")
    .upsert(
      {
        user_id: context.userId,
        anonymous_id: context.userId ? null : context.anonymousId,
        phone_hash: phoneHash,
        chain_id: BASE_MAINNET_CHAIN_ID,
        network: BASE_MAINNET_NETWORK,
        status: "pending_provisioning",
        metadata: {
          baseGaslessMinting: true,
          assignedAfter: "otp_verification",
          phoneLast4: phoneLast4(phoneNumber),
        },
      },
      { onConflict: "phone_hash,chain_id" },
    )
    .select("id, wallet_address, status")
    .single();

  if (walletError) return storageError(walletError);

  const metadata = mergeMetadata(report.metadata, {
    phoneVerification: {
      ...report.metadata?.phoneVerification,
      status: "verified",
      verifiedAt: new Date().toISOString(),
      phoneLast4: phoneLast4(phoneNumber),
      otpHash: undefined,
    },
    onchain: {
      gasless: true,
      network: BASE_MAINNET_NETWORK,
      chainId: BASE_MAINNET_CHAIN_ID,
      mintStatus: "queued",
      queuedAfter: "phone_verification",
    },
  });

  const { error } = await context.serviceClient
    .from("disaster_reports")
    .update({
      phone_verification_status: "verified",
      phone_verified_at: new Date().toISOString(),
      verification_status: "verified",
      proxy_wallet_id: wallet.id,
      proxy_wallet_address: wallet.wallet_address,
      onchain_mint_status: "queued",
      metadata,
    })
    .eq("id", report.id);

  if (error) return storageError(error);

  return NextResponse.json({
    verified: true,
    proxyWallet: {
      id: wallet.id,
      address: wallet.wallet_address ?? undefined,
      network: BASE_MAINNET_NETWORK,
      chainId: BASE_MAINNET_CHAIN_ID,
      status: wallet.status,
    },
    mint: {
      network: BASE_MAINNET_NETWORK,
      chainId: BASE_MAINNET_CHAIN_ID,
      status: "queued",
    },
  });
}

async function loadOwnedReport(context: ReportContextReady, reportId: string) {
  const { data: report, error } = await context.serviceClient
    .from("disaster_reports")
    .select("id, user_id, anonymous_id, metadata")
    .eq("id", reportId)
    .eq("source_app", "aeris-chat")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { response: NextResponse.json({ error: "Report not found." }, { status: 404 }) };
    }
    return { response: storageError(error) };
  }

  const ownsReport = context.userId
    ? report.user_id === context.userId
    : report.anonymous_id === context.anonymousId;

  if (!ownsReport) {
    return {
      response: NextResponse.json(
        { error: "You can only verify your own reports." },
        { status: 403 },
      ),
    };
  }

  return { report };
}

type ReportContext =
  | ReportContextReady
  | { response: NextResponse };

type ReportContextReady = {
  userId: string | null;
  anonymousId: string;
  serviceClient: ServiceClient;
};

async function getReportContext(
  request: NextRequest,
  anonymousId?: string,
): Promise<ReportContext> {
  const supabase = await createClient();
  let userId: string | null = null;

  if (!AUTH_DISABLED && supabase?.auth) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  if (!userId && !anonymousId) {
    return {
      response: NextResponse.json(
        { error: "anonymousId is required for anonymous verification." },
        { status: 400 },
      ),
    };
  }

  const serviceClient = await getServiceClient();
  if (!serviceClient) {
    return {
      response: NextResponse.json(
        { error: "Shared Supabase intake is not configured." },
        { status: 500 },
      ),
    };
  }

  return {
    userId,
    anonymousId: anonymousId ?? "",
    serviceClient,
  };
}

async function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function mergeMetadata(current: unknown, patch: Record<string, unknown>) {
  return {
    ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}),
    ...patch,
  };
}

function createOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storageError(error: { code?: string; message: string }) {
  if (
    error.code === "42P01" ||
    /disaster_reports|report_proxy_wallets|schema cache|does not exist/i.test(error.message)
  ) {
    return NextResponse.json(
      { error: "Onchain report tables are missing. Apply the latest Supabase migrations." },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
