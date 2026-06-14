"use client";

import React from "react";
import { X, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewsPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewsPanelModal({ isOpen, onClose }: NewsPanelModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-2 md:p-4 pointer-events-none">
        <div
          className={cn(
            "bg-background border border-border rounded-lg shadow-xl",
            "w-full max-w-md",
            "flex flex-col pointer-events-auto overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 duration-200",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 md:px-6 md:py-4 flex-shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              <Newspaper className="h-5 w-5 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold leading-tight text-foreground md:text-lg">
                  News
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  Disaster updates and advisories
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close news panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Coming soon</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              Local and national disaster news feeds will appear here in a future update.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
