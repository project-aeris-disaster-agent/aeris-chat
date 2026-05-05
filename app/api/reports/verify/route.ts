export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { updateReport } from "@/lib/reports/store";

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "";
    const reportId = typeof body.reportId === "string" ? body.reportId : "";
    const anonymousId = typeof body.anonymousId === "string" ? body.anonymousId : "";

    if (!reportId) {
      return NextResponse.json({ error: "reportId is required" }, { status: 400 });
    }
    if (!anonymousId) {
      return NextResponse.json({ error: "anonymousId is required" }, { status: 400 });
    }

    if (action === "request") {
      const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
      if (!phoneNumber) {
        return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
      }

      const code = generateOtpCode();
      const report = await updateReport(reportId, anonymousId, (current) => ({
        ...current,
        verificationOtp: {
          code,
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
        devOtpCode: code,
        message: "Development OTP generated.",
      });
    }

    if (action === "verify") {
      const otpCode = typeof body.otpCode === "string" ? body.otpCode.trim() : "";
      const report = await updateReport(reportId, anonymousId, (current) => {
        if (!current.verificationOtp || current.verificationOtp.code !== otpCode) {
          return current;
        }

        return {
          ...current,
          verificationStatus: "verified",
          metadata: {
            ...current.metadata,
            verifiedPhoneNumber: current.verificationOtp.phoneNumber,
            verifiedAt: new Date().toISOString(),
          },
          onchain: {
            ...current.onchain,
            phoneVerificationStatus: "verified",
            proxyWallet: {
              id: crypto.randomUUID(),
              address: `0x${crypto.randomUUID().replace(/-/g, "").padEnd(40, "0").slice(0, 40)}`,
              network: "base-mainnet",
              chainId: 8453,
              status: "assigned",
            },
            mint: {
              ...current.onchain.mint,
              status: "queued",
            },
          },
        };
      });

      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }
      if (report.verificationStatus !== "verified") {
        return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
      }

      return NextResponse.json({ ok: true, report });
    }

    return NextResponse.json({ error: "Unsupported verification action" }, { status: 400 });
  } catch (error) {
    console.error("Report verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
