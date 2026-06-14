"use client";

import React from "react";
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  ImagePlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type DraftCategory,
  type DraftIncidentReport,
} from "@/lib/incidents/intent";

const CATEGORY_LABELS: Record<DraftCategory, string> = {
  flood: "Flood",
  landslide: "Landslide",
  stranded: "Stranded / Rescue Needed",
  SOS: "SOS / Life Threat",
  infra_damage: "Infrastructure Damage",
  power_out: "Power Outage",
  road_closed: "Road Closed",
};

type IncidentDetectionPopupProps = {
  isOpen: boolean;
  draft: DraftIncidentReport | null;
  /** User chose not to file a report. */
  onDismiss: () => void;
  /**
   * User finished the photo step. `photoFile` is the captured image, or null
   * if the user skipped the photo. The parent opens the report form next.
   */
  onProceed: (photoFile: File | null) => void;
};

type Step = "detected" | "photo";

export function IncidentDetectionPopup({
  isOpen,
  draft,
  onDismiss,
  onProceed,
}: IncidentDetectionPopupProps) {
  const [step, setStep] = React.useState<Step>("detected");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // Reset to the first step whenever the popup re-opens.
  React.useEffect(() => {
    if (isOpen) {
      setStep("detected");
      setPhotoFile(null);
      setPhotoPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    }
  }, [isOpen]);

  React.useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  if (!isOpen || !draft) return null;

  const handlePhotoSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setPhotoFile(file);
    setPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };

  const urgent = draft.urgent || draft.suggestedSeverity === "critical";

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm"
        onClick={onDismiss}
      />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Header */}
          <div
            className={cn(
              "flex items-start gap-3 border-b border-border px-5 py-4",
              urgent ? "bg-red-500/10" : "bg-yellow-500/10",
            )}
          >
            <AlertTriangle
              className={cn(
                "mt-0.5 h-6 w-6 flex-shrink-0",
                urgent
                  ? "text-red-600 dark:text-red-400"
                  : "text-yellow-600 dark:text-yellow-400",
              )}
            />
            <div className="flex-1">
              <h2 className="text-base font-bold leading-tight text-foreground">
                AERIS detected a possible incident
                {urgent && (
                  <span className="ml-2 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white align-middle">
                    URGENT
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {step === "detected"
                  ? "Step 1 of 2 — Confirm what's happening"
                  : "Step 2 of 2 — Add a photo"}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Dismiss incident detection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          {step === "detected" ? (
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="text-foreground">
                  <span className="font-semibold">
                    {CATEGORY_LABELS[draft.category]}
                  </span>{" "}
                  · {draft.description}
                </p>
                {draft.locationHint && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Near {draft.locationHint}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Would you like AERIS to help you file a disaster report? We&apos;ll
                guide you step by step — it only takes a moment.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button
                  type="button"
                  className={cn(
                    "flex-1 gap-1",
                    urgent
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-yellow-500 text-black hover:bg-yellow-600",
                  )}
                  onClick={() => setStep("photo")}
                >
                  Yes, file a report
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={onDismiss}
                >
                  Not now
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                A photo helps responders verify the situation. Take one now if
                it&apos;s safe — or skip and add it later.
              </p>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelected}
              />

              {photoPreview ? (
                <div className="relative w-full overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Captured evidence preview"
                    className="max-h-56 w-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute bottom-2 right-2 gap-1.5"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Retake
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-muted-foreground transition hover:border-primary/50 hover:bg-muted/50"
                >
                  <Camera className="h-8 w-8" />
                  <span className="text-sm font-medium">Take a photo</span>
                  <span className="text-xs">Tap to open your camera</span>
                </button>
              )}

              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button
                  type="button"
                  className="flex-1 gap-1"
                  onClick={() => onProceed(photoFile)}
                >
                  {photoFile ? (
                    <>
                      <ImagePlus className="h-4 w-4" />
                      Continue with photo
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                {!photoFile && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onProceed(null)}
                  >
                    Skip photo
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
