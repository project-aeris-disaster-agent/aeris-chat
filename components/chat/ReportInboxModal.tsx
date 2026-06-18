"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Inbox, LogOut, RefreshCw, ShieldCheck, Trash2, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAnonymousSessionId } from "@/lib/utils/anonymous-session";
import { useUserProfile } from "@/contexts/ProfileContext";
import { levelProgress } from "@/lib/gamification";
import { cn } from "@/lib/utils";

type ReportInboxModalProps = {
  isOpen: boolean;
  onClose: () => void;
  refreshKey?: number;
};

type ReportSummary = {
  id: string;
  messageId?: string;
  category: string;
  description: string;
  position: [number, number];
  locationAccuracyM?: number;
  photoUrl?: string;
  createdAt: string;
  confirmations: number;
  confidence?: number;
  verificationStatus?: string;
  moderationStatus?: string;
  onchain?: {
    phoneVerificationStatus?: string;
    proxyWallet?: {
      id?: string;
      address?: string;
      network: string;
      chainId: number;
      status?: string;
    };
    mint?: {
      network: string;
      chainId: number;
      status: string;
      txHash?: string;
      tokenId?: string;
      mintedAt?: string;
    };
  };
};

const CATEGORY_LABELS: Record<string, string> = {
  flood: "Flood",
  landslide: "Landslide",
  stranded: "Stranded / Rescue Needed",
  SOS: "SOS / Life Threat",
  infra_damage: "Infrastructure Damage",
  power_out: "Power Outage",
  road_closed: "Road Closed",
};

export function ReportInboxModal({ isOpen, onClose, refreshKey = 0 }: ReportInboxModalProps) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  const {
    profile,
    loading: profileLoading,
    ready: privyReady,
    authenticated,
    privyEnabled,
    login,
    logout,
  } = useUserProfile();

  // Prompt Privy login the first time the inbox is opened by an anonymous user.
  // Reports stay viewable either way, but signing in unlocks profile + XP and
  // lets verified reports earn rewards back to this account.
  const promptedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      promptedRef.current = false;
      return;
    }
    if (privyEnabled && privyReady && !authenticated && !promptedRef.current) {
      promptedRef.current = true;
      login();
    }
  }, [isOpen, privyEnabled, privyReady, authenticated, login]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setStatus(null);

    try {
      const params = new URLSearchParams({ anonymousId: getAnonymousSessionId() });
      const response = await fetch(`/api/reports?${params}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? `Unable to load reports (${response.status})`);
      }

      setReports(Array.isArray(body.reports) ? body.reports : []);
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadReports();
  }, [isOpen, loadReports, refreshKey]);

  const deleteReport = async (report: ReportSummary) => {
    const confirmed = window.confirm("Delete this disaster report? This cannot be undone.");
    if (!confirmed) return;

    setDeletingId(report.id);
    setStatus(null);

    try {
      const response = await fetch("/api/reports", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: report.id,
          anonymousId: getAnonymousSessionId(),
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? `Unable to delete report (${response.status})`);
      }

      setReports((current) => current.filter((item) => item.id !== report.id));
      setStatus({ tone: "ok", message: "Report deleted." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl",
            "max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-200",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Inbox className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground md:text-2xl">Profile &amp; Reports</h2>
                <p className="text-sm text-muted-foreground">
                  Your AERIS profile, XP, and reports sent from this browser.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close report inbox">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {privyEnabled ? (
            <ProfilePanel
              profile={profile}
              loading={profileLoading}
              ready={privyReady}
              authenticated={authenticated}
              onLogin={login}
              onLogout={() => void logout()}
            />
          ) : null}

          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading reports..." : `${reports.length} report${reports.length === 1 ? "" : "s"}`}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadReports()} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            {status && (
              <p
                className={cn(
                  "mb-4 rounded-md border px-3 py-2 text-sm",
                  status.tone === "ok"
                    ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
                    : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
                )}
              >
                {status.message}
              </p>
            )}

            {!loading && reports.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="font-medium text-foreground">No reports yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submitted reports from this browser will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <article key={report.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            {CATEGORY_LABELS[report.category] ?? report.category}
                          </span>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                            {report.verificationStatus ?? "unverified"}
                          </span>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                            mint: {report.onchain?.mint?.status ?? "not_started"}
                          </span>
                        </div>
                        <p className="mt-2 font-mono text-xs text-muted-foreground">
                          Message ID: {report.messageId ?? report.id}
                        </p>
                        <p className="mt-3 text-sm text-foreground">{report.description}</p>
                        {report.photoUrl ? (
                          <a
                            href={report.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 block w-fit overflow-hidden rounded-md border border-border"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={report.photoUrl}
                              alt="Report evidence"
                              loading="lazy"
                              className="max-h-40 w-auto object-cover"
                            />
                          </a>
                        ) : null}
                        <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                          <span>{formatDate(report.createdAt)}</span>
                          <span>
                            Location: {report.position[1].toFixed(4)}, {report.position[0].toFixed(4)}
                          </span>
                          {report.locationAccuracyM ? (
                            <span>Accuracy: about {Math.round(report.locationAccuracyM)}m</span>
                          ) : null}
                          <span>Confirmations: {report.confirmations}</span>
                          <span>
                            Phone: {report.onchain?.phoneVerificationStatus ?? "unverified"}
                          </span>
                          <span>
                            BASE: {report.onchain?.mint?.network ?? "base-mainnet"} (
                            {report.onchain?.mint?.chainId ?? 8453})
                          </span>
                        </div>
                        {report.onchain?.mint?.txHash ? (
                          <a
                            href={`https://basescan.org/tx/${report.onchain.mint.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
                          >
                            View BASE transaction
                          </a>
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Transaction hash will appear here after verified minting completes.
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => void deleteReport(report)}
                        disabled={deletingId === report.id}
                        className="shrink-0"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingId === report.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

type ProfilePanelProps = {
  profile: ReturnType<typeof useUserProfile>["profile"];
  loading: boolean;
  ready: boolean;
  authenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

function ProfilePanel({
  profile,
  loading,
  ready,
  authenticated,
  onLogin,
  onLogout,
}: ProfilePanelProps) {
  if (!ready) {
    return (
      <div className="border-b border-border px-4 py-4 md:px-6">
        <div className="h-12 w-full animate-pulse rounded-lg bg-muted" aria-hidden />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="border-b border-border bg-muted/30 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Sign in to track your profile &amp; XP</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Earn XP for reports you submit and keep your level synced across AERIS.
              </p>
            </div>
          </div>
          <Button type="button" onClick={onLogin} className="shrink-0">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Sign in with Privy
          </Button>
        </div>
      </div>
    );
  }

  if (loading && !profile) {
    return (
      <div className="border-b border-border px-4 py-4 md:px-6">
        <div className="h-12 w-full animate-pulse rounded-lg bg-muted" aria-hidden />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-between border-b border-border px-4 py-4 md:px-6">
        <p className="text-sm text-muted-foreground">Profile unavailable right now.</p>
        <Button type="button" variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    );
  }

  const progress = levelProgress(profile.xp);
  const pct = progress.isMax ? 100 : Math.round(progress.ratio * 100);

  return (
    <div className="border-b border-border bg-muted/20 px-4 py-4 md:px-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white shadow-sm">
          <span className="text-[10px] font-medium uppercase leading-none opacity-80">Lvl</span>
          <span className="text-xl font-bold leading-none">{profile.level}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-base font-bold text-foreground">{profile.username}</p>
            <Button type="button" variant="ghost" size="sm" onClick={onLogout} className="shrink-0">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {progress.isMax
                ? `${profile.xp.toLocaleString()} XP · MAX`
                : `${progress.xpIntoLevel}/${progress.xpForNextLevel} XP`}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Total XP: {profile.xp.toLocaleString()}</span>
            {profile.email ? <span className="truncate">{profile.email}</span> : null}
            {profile.proxyWalletAddress ? (
              <span className="font-mono">
                {profile.proxyWalletAddress.slice(0, 6)}…{profile.proxyWalletAddress.slice(-4)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
