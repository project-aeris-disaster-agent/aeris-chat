export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { updateReport } from "@/lib/reports/store";
import {
  getSharedReportOtp,
  getSharedSupabaseReportById,
  patchSharedReportMetadata,
  patchSharedReportPhoneVerified,
  sharedSupabaseReportsEnabled,
} from "@/lib/reports/shared-supabase";
import {
  buildStoredOtp,
  generateOtpCode,
  hashOtpCode,
  shouldExposeDevOtp,
  verifyStoredOtp,
} from "@/lib/security/otp";
import {
  checkRateLimit,
  clientRateKey,
  rateLimitRetryAfterSeconds,
} from "@/lib/security/rate-limit";
import { resolveAnonId } from "@/lib/security/anon-identity";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "";
    const reportId = typeof body.reportId === "string" ? body.reportId : "";
    const anonymousId = await resolveAnonId(
      typeof body.anonymousId === "string" ? body.anonymousId : undefined,
    );

    if (!reportId) {
      return NextResponse.json({ error: "reportId is required" }, { status: 400 });
    }

    // Throttle both requesting and verifying to blunt OTP brute force / SMS abuse.
    const otpLimit = checkRateLimit(clientRateKey(`report-otp-${action}`, request, anonymousId), {
      windowMs: 60_000,
      max: action === "verify" ? 8 : 3,
    });
    if (!otpLimit.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please wait a moment." },
        {
          status: 429,
          headers: { "retry-after": String(rateLimitRetryAfterSeconds(otpLimit)) },
        },
      );
    }

    if (action === "request") {
      const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
      if (!phoneNumber) {
        return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
      }

      const code = generateOtpCode();

      if (sharedSupabaseReportsEnabled()) {
        const existing = await getSharedSupabaseReportById(reportId);
        if (!existing) {
          return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        const stored = await buildStoredOtp(code, phoneNumber);
        const ok = await patchSharedReportMetadata(reportId, {
          otp: stored,
          phone_verification_status: "otp_requested",
        });
        if (!ok) {
          return NextResponse.json(
            { error: "Unable to start verification for this report." },
            { status: 502 },
          );
        }
        return NextResponse.json({
          ok: true,
          message: "Verification code sent.",
          ...(shouldExposeDevOtp() ? { devOtpCode: code } : {}),
        });
      }

      // Dev-only local file store when Supabase service creds are absent.
      const codeHash = await hashOtpCode(code, phoneNumber);
      const report = await updateReport(reportId, anonymousId, (current) => ({
        ...current,
        verificationOtp: {
          codeHash,
          phoneNumber,
          requestedAt: new Date().toISOString(),
        },
        onchain: {
          ...current.onchain,
          phoneVerificationStatus: "otp_requested",
        },
      }));

      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        message: "Verification code sent.",
        ...(shouldExposeDevOtp() ? { devOtpCode: code } : {}),
      });
    }

    if (action === "verify") {
      const otpCode = typeof body.otpCode === "string" ? body.otpCode.trim() : "";
      const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";

      if (!otpCode) {
        return NextResponse.json({ error: "otpCode is required" }, { status: 400 });
      }

      if (sharedSupabaseReportsEnabled()) {
        const shared = await getSharedSupabaseReportById(reportId);
        if (!shared) {
          return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        const stored = await getSharedReportOtp(reportId);
        const check = await verifyStoredOtp(
          stored,
          otpCode,
          phoneNumber || stored?.phoneNumber || "",
        );
        if (!check.ok) {
          if (stored) {
            await patchSharedReportMetadata(reportId, {
              otp: { ...stored, attempts: (stored.attempts ?? 0) + 1 },
            });
          }
          return NextResponse.json(
            { error: "Invalid or expired verification code." },
            { status: 400 },
          );
        }

        const updated = await patchSharedReportPhoneVerified(
          reportId,
          stored?.phoneNumber || phoneNumber,
        );
        if (!updated) {
          return NextResponse.json({ error: "Unable to verify shared report." }, { status: 502 });
        }
        return NextResponse.json({ ok: true, report: updated });
      }

      // Dev-only local file store when Supabase service creds are absent.
      const current = await updateReport(reportId, anonymousId, (c) => c);
      if (!current) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      const candidateHash = await hashOtpCode(
        otpCode,
        phoneNumber || current.verificationOtp?.phoneNumber || "",
      );
      if (
        !current.verificationOtp?.codeHash ||
        current.verificationOtp.codeHash !== candidateHash
      ) {
        return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
      }

      const report = await updateReport(reportId, anonymousId, (c) => ({
        ...c,
        verificationStatus: "verified",
        verificationOtp: undefined,
        metadata: {
          ...c.metadata,
          verifiedPhoneNumber: c.verificationOtp?.phoneNumber,
          verifiedAt: new Date().toISOString(),
        },
        onchain: {
          ...c.onchain,
          phoneVerificationStatus: "verified",
          proxyWallet: {
            id: crypto.randomUUID(),
            address: `0x${crypto.randomUUID().replace(/-/g, "").padEnd(40, "0").slice(0, 40)}`,
            network: "base-mainnet",
            chainId: 8453,
            status: "assigned",
          },
          mint: {
            ...c.onchain.mint,
            status: "queued",
          },
        },
      }));

      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, report });
    }

    return NextResponse.json({ error: "Unsupported verification action" }, { status: 400 });
  } catch (error) {
    console.error("Report verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
