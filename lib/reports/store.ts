import { promises as fs } from "fs";
import path from "path";

export type DisasterReport = {
  id: string;
  messageId: string;
  category: string;
  description: string;
  position: [number, number];
  locationAccuracyM?: number;
  photoUrl?: string;
  createdAt: string;
  anonymousId: string;
  sessionId?: string;
  confirmations: number;
  confidence?: number;
  verificationStatus: "unverified" | "verified";
  moderationStatus: "pending" | "approved" | "rejected";
  metadata: Record<string, unknown>;
  onchain: {
    phoneVerificationStatus: "unverified" | "otp_requested" | "verified";
    proxyWallet?: {
      id?: string;
      address?: string;
      network: string;
      chainId: number;
      status?: string;
    };
    mint: {
      network: string;
      chainId: number;
      status: "not_started" | "queued" | "minted" | "failed";
      txHash?: string;
      tokenId?: string;
      mintedAt?: string;
    };
  };
  verificationOtp?: {
    codeHash: string;
    requestedAt: string;
    phoneNumber: string;
  };
};

type ReportStore = {
  reports: DisasterReport[];
};

const STORE_PATH = path.join(process.cwd(), ".data", "reports.json");

async function readStore(): Promise<ReportStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ReportStore>;
    return { reports: Array.isArray(parsed.reports) ? parsed.reports : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { reports: [] };
    }
    throw error;
  }
}

async function writeStore(store: ReportStore): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function listReports(anonymousId: string): Promise<DisasterReport[]> {
  const store = await readStore();
  return store.reports
    .filter((report) => report.anonymousId === anonymousId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createReport(input: {
  category: string;
  description: string;
  position: [number, number];
  anonymousId: string;
  sessionId?: string;
  locationAccuracyM?: number;
  photoUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<DisasterReport> {
  const store = await readStore();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const report: DisasterReport = {
    id,
    messageId: `AERIS-${createdAt.slice(0, 10).replace(/-/g, "")}-${id.slice(0, 8).toUpperCase()}`,
    category: input.category,
    description: input.description,
    position: input.position,
    anonymousId: input.anonymousId,
    sessionId: input.sessionId,
    locationAccuracyM: input.locationAccuracyM,
    photoUrl: input.photoUrl,
    createdAt,
    confirmations: 0,
    confidence: 0,
    verificationStatus: "unverified",
    moderationStatus: "pending",
    metadata: input.metadata ?? {},
    onchain: {
      phoneVerificationStatus: "unverified",
      mint: {
        network: "base-mainnet",
        chainId: 8453,
        status: "not_started",
      },
    },
  };

  store.reports.unshift(report);
  await writeStore(store);
  return report;
}

export async function deleteReport(id: string, anonymousId: string): Promise<boolean> {
  const store = await readStore();
  const initialLength = store.reports.length;
  store.reports = store.reports.filter((report) => !(report.id === id && report.anonymousId === anonymousId));
  if (store.reports.length === initialLength) return false;
  await writeStore(store);
  return true;
}

export async function updateReport(
  id: string,
  anonymousId: string,
  updater: (report: DisasterReport) => DisasterReport,
): Promise<DisasterReport | null> {
  const store = await readStore();
  const index = store.reports.findIndex((report) => report.id === id && report.anonymousId === anonymousId);
  if (index === -1) return null;

  const updated = updater(store.reports[index]);
  store.reports[index] = updated;
  await writeStore(store);
  return updated;
}
