"use client";

import React from "react";
import Image from "next/image";
import { Phone, Heart, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import adsBanner from "@/assets/ads_v2_2026.gif";

type BottomNavBarProps = {
  onOpenHotlines: () => void;
  onActivateSOS: () => void;
  onOpenDonate: () => void;
  className?: string;
};

type NavItemProps = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
};

function NavItem({ label, icon: Icon, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[44px]"
    >
      <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
      <span className="text-[10px] font-medium leading-none md:text-[11px]">{label}</span>
    </button>
  );
}

export function AdBanner({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Advertisement"
      className={cn(
        "relative z-30 flex-shrink-0 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className,
      )}
    >
      <div className="w-full">
        <Image
          src={adsBanner}
          alt="Advertisement"
          width={600}
          height={68}
          unoptimized
          priority
          sizes="(max-width: 896px) 100vw, 896px"
          className="block h-auto w-full min-w-0 object-contain"
        />
      </div>
    </nav>
  );
}

export function QuickActionsNav({
  onOpenHotlines,
  onActivateSOS,
  onOpenDonate,
  className,
}: BottomNavBarProps) {
  return (
    <nav
      aria-label="Quick actions"
      className={cn(
        "relative z-30 flex-shrink-0 w-full border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-2 md:pb-1.5 lg:pb-2",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-1 py-1.5 md:py-1">
        <NavItem label="Hotlines" icon={Phone} onClick={onOpenHotlines} />

        <div className="flex flex-1 flex-col items-center justify-center">
          <button
            type="button"
            onClick={onActivateSOS}
            aria-label="Activate SOS emergency mode"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg shadow-red-900/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 md:h-10 md:w-10"
            style={{
              background:
                "linear-gradient(90deg, #b91c1c 0%, #ef4444 50%, #b91c1c 100%)",
              backgroundSize: "200% 100%",
              animation: "gradient 3s ease infinite",
              border: "none",
            }}
          >
            <Siren className="h-6 w-6 md:h-5 md:w-5" />
          </button>
          <span className="mt-0.5 text-[10px] font-bold leading-none text-red-600 dark:text-red-400 md:text-[11px]">
            SOS
          </span>
        </div>

        <NavItem label="Donate" icon={Heart} onClick={onOpenDonate} />
      </div>
    </nav>
  );
}
