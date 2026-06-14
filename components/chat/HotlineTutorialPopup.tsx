"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Droplet,
  Flame,
  HeartPulse,
  LifeBuoy,
  Phone,
  Power,
  ShieldAlert,
  Siren,
  Tent,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CallTarget = {
  label: string;
  number: string;
};

type GuideStep = {
  id: string;
  icon: LucideIcon;
  situation: string;
  guidance: string;
  calls: CallTarget[];
  urgent?: boolean;
};

/**
 * Scenario-based guide that tells Naga City citizens which agency to call for
 * each kind of emergency. Numbers mirror the entries in emergency-hotlines.ts.
 */
const GUIDE_STEPS: GuideStep[] = [
  {
    id: "life-threat",
    icon: Siren,
    situation: "Life-threatening emergency",
    guidance:
      "Always call 911 first. It's the national hotline that connects you to police, fire, medical, and rescue anywhere in the Philippines.",
    calls: [{ label: "National Emergency", number: "911" }],
    urgent: true,
  },
  {
    id: "rescue",
    icon: LifeBuoy,
    situation: "Trapped, flooding, or need rescue",
    guidance:
      "Call the Naga City Central Command Center (Comcen) or CDRRMO. They dispatch rescue teams and coordinate disaster response 24/7.",
    calls: [
      { label: "Central Command Center", number: "0963-220-9700" },
      { label: "CDRRMO", number: "0947-633-0066" },
    ],
    urgent: true,
  },
  {
    id: "medical",
    icon: HeartPulse,
    situation: "Medical emergency or injury",
    guidance:
      "Call the hospital emergency room directly for ambulance dispatch and trauma care, or dial 911 if no one can drive.",
    calls: [
      { label: "Bicol Medical Center ER", number: "(054) 472-6125" },
      { label: "National Emergency", number: "911" },
    ],
  },
  {
    id: "fire",
    icon: Flame,
    situation: "Fire or smoke",
    guidance:
      "Report fires immediately to the Bureau of Fire Protection (Naga City). Give your exact street and nearest landmark.",
    calls: [{ label: "BFP Naga City", number: "0923-083-9429" }],
    urgent: true,
  },
  {
    id: "evacuation",
    icon: Tent,
    situation: "Need evacuation center info",
    guidance:
      "CDRRMO manages evacuation centers and relief operations. Call to find the nearest open shelter before a storm or flood worsens.",
    calls: [{ label: "Naga City CDRRMO", number: "0947-633-0066" }],
  },
  {
    id: "police",
    icon: ShieldAlert,
    situation: "Crime, accident, or safety threat",
    guidance:
      "Call the Naga City Police Office for crimes, road accidents, or any threat to your safety.",
    calls: [{ label: "Naga City Police Office", number: "0908-325-4787" }],
  },
  {
    id: "power",
    icon: Power,
    situation: "Power outage or downed lines",
    guidance:
      "Report to CASURECO II. Stay far away from fallen electrical wires and never touch flooded outlets.",
    calls: [{ label: "CASURECO II", number: "(054) 205-2900" }],
  },
  {
    id: "water",
    icon: Droplet,
    situation: "No water or burst pipe",
    guidance:
      "Report leaks, burst pipes, or no-water incidents to the Metro Naga Water District 24/7 hotline.",
    calls: [{ label: "Metro Naga Water District", number: "(054) 206-3040" }],
  },
];

type HotlineTutorialPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the user taps a number so the parent can place the call. */
  onCall: (phone: string) => void;
};

export function HotlineTutorialPopup({
  isOpen,
  onClose,
  onCall,
}: HotlineTutorialPopupProps) {
  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    if (isOpen) setStepIndex(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const totalSteps = GUIDE_STEPS.length;
  const step = GUIDE_STEPS[stepIndex];
  const Icon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const urgent = step.urgent;

  const goNext = () => {
    if (isLast) {
      onClose();
    } else {
      setStepIndex((index) => Math.min(index + 1, totalSteps - 1));
    }
  };

  const goBack = () => {
    setStepIndex((index) => Math.max(index - 1, 0));
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[10002] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[10003] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Header */}
          <div
            className={cn(
              "flex items-start gap-3 border-b border-border px-5 py-4",
              urgent ? "bg-red-500/10" : "bg-primary/10",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-6 w-6 flex-shrink-0",
                urgent
                  ? "text-red-600 dark:text-red-400"
                  : "text-primary",
              )}
            />
            <div className="flex-1">
              <h2 className="text-base font-bold leading-tight text-foreground">
                Who should I call?
                {urgent && (
                  <span className="ml-2 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white align-middle">
                    URGENT
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Step {stepIndex + 1} of {totalSteps} — AERIS hotline guide
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close hotline guide"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 px-5 pt-4">
            {GUIDE_STEPS.map((guideStep, index) => (
              <span
                key={guideStep.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  index <= stepIndex ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>

          {/* Body */}
          <div className="space-y-4 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {step.situation}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {step.guidance}
              </p>
            </div>

            <div className="space-y-2">
              {step.calls.map((call) => (
                <button
                  key={`${call.label}-${call.number}`}
                  type="button"
                  onClick={() => onCall(call.number)}
                  aria-label={`Call ${call.label}: ${call.number}`}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors min-h-[56px]",
                    urgent
                      ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent",
                  )}
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">
                      {call.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Tap to call now
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-white",
                      urgent ? "bg-red-600" : "bg-primary",
                    )}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {call.number}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 border-t border-border px-5 py-4">
            <Button
              type="button"
              variant="outline"
              className="gap-1"
              onClick={goBack}
              disabled={isFirst}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              className="ml-auto flex-1 gap-1 sm:flex-none"
              onClick={goNext}
            >
              {isLast ? (
                "Done"
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
