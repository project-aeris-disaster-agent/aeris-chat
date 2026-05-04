export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_MAINNET_NETWORK = "base-mainnet";

export type OnchainReportStatus = {
  messageId: string;
  phoneVerificationStatus: "unverified" | "pending" | "verified" | "failed";
  proxyWallet?: {
    id?: string;
    address?: string;
    network: typeof BASE_MAINNET_NETWORK;
    chainId: typeof BASE_MAINNET_CHAIN_ID;
    status?: string;
  };
  mint: {
    network: typeof BASE_MAINNET_NETWORK;
    chainId: typeof BASE_MAINNET_CHAIN_ID;
    status: "not_started" | "queued" | "minting" | "minted" | "failed";
    txHash?: string;
    tokenId?: string;
    mintedAt?: string;
  };
};

export function createReportMessageId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `AERIS-${timestamp}-${random}`;
}

export function normalizePhoneNumber(raw: string): string | null {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  if (cleaned.startsWith("+")) {
    return /^\+\d{10,15}$/.test(cleaned) ? cleaned : null;
  }

  if (cleaned.startsWith("09") && cleaned.length === 11) {
    return `+63${cleaned.slice(1)}`;
  }

  if (cleaned.startsWith("63") && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  return /^\d{10,15}$/.test(cleaned) ? `+${cleaned}` : null;
}

export function phoneLast4(normalizedPhone: string): string {
  return normalizedPhone.slice(-4);
}

export async function hashPhoneNumber(normalizedPhone: string): Promise<string> {
  const data = new TextEncoder().encode(`${normalizedPhone}|aeris-report-phone-salt`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashOtpCode(code: string, reportId: string): Promise<string> {
  const data = new TextEncoder().encode(`${reportId}|${code}|aeris-report-otp-salt`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
