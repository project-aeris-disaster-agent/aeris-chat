"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Phone, ShieldCheck, MessageCircle } from "lucide-react";

export type FollowUpAction = "hotlines" | "verify_phone" | "status_update";

type FollowUpActionsProps = {
  actions: FollowUpAction[];
  reportId?: string;
  reportMessageId?: string;
  onOpenHotlines?: () => void;
  onOpenReportInbox?: () => void;
  onStatusUpdate?: (reportId: string | undefined) => void;
};

const META: Record<FollowUpAction, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  hotlines: { label: "Open emergency hotlines", icon: Phone },
  verify_phone: { label: "Verify phone for this report", icon: ShieldCheck },
  status_update: { label: "Send a status update", icon: MessageCircle },
};

export function FollowUpActions({
  actions,
  reportId,
  onOpenHotlines,
  onOpenReportInbox,
  onStatusUpdate,
}: FollowUpActionsProps) {
  const handle = (action: FollowUpAction) => {
    if (action === "hotlines") {
      onOpenHotlines?.();
    } else if (action === "verify_phone") {
      onOpenReportInbox?.();
    } else if (action === "status_update") {
      onStatusUpdate?.(reportId);
    }
  };

  if (!actions.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = META[action].icon;
        return (
          <Button
            key={action}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handle(action)}
            className="bg-white/80 dark:bg-black/40"
          >
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {META[action].label}
          </Button>
        );
      })}
    </div>
  );
}
