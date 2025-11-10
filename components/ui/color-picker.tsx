"use client";

import React from "react";
import { Palette, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  { name: "Sky Blue", value: [[135, 206, 250]] },
  { name: "Cyan", value: [[0, 255, 255]] },
  { name: "Red", value: [[245, 5, 55]] },
  { name: "Purple", value: [[147, 51, 234]] },
  { name: "Blue", value: [[59, 130, 246]] },
  { name: "Green", value: [[34, 197, 94]] },
  { name: "Orange", value: [[249, 115, 22]] },
  { name: "Pink", value: [[236, 72, 153]] },
  { name: "Yellow", value: [[234, 179, 8]] },
  { name: "Gradient 1", value: [[59, 130, 246], [147, 51, 234]] },
  { name: "Gradient 2", value: [[236, 72, 153], [249, 115, 22]] },
  { name: "Gradient 3", value: [[34, 197, 94], [59, 130, 246]] },
];

export interface AnimationSettings {
  animationSpeed: number;
  opacityMin: number;
  opacityMax: number;
  dotSize: number;
  hue: number;
  saturation: number;
  contrast: number;
  glow: number;
}

interface ColorPickerProps {
  selectedColors: number[][];
  onColorChange: (colors: number[][]) => void;
  animationSettings?: AnimationSettings;
  onAnimationSettingsChange?: (settings: AnimationSettings) => void;
  className?: string;
}

export function ColorPicker({
  selectedColors,
  onColorChange,
  animationSettings,
  onAnimationSettingsChange,
  className,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const defaultSettings: AnimationSettings = {
    animationSpeed: 0.1,
    opacityMin: 0.5,
    opacityMax: 1.0,
    dotSize: 6,
    hue: 0,
    saturation: 1.0,
    contrast: 1.0,
    glow: 0.0,
  };

  const settings = animationSettings || defaultSettings;

  const getColorPreview = (colors: number[][]) => {
    if (colors.length === 1) {
      const [r, g, b] = colors[0];
      return `rgb(${r}, ${g}, ${b})`;
    }
    // For gradients, show first color
    const [r, g, b] = colors[0];
    return `rgb(${r}, ${g}, ${b})`;
  };

  const handleSettingsChange = (key: keyof AnimationSettings, value: number) => {
    if (onAnimationSettingsChange) {
      onAnimationSettingsChange({
        ...settings,
        [key]: value,
      });
    }
  };

  // Generate opacity array from min/max
  const generateOpacities = (min: number, max: number): number[] => {
    const steps = 10;
    const range = max - min;
    return Array.from({ length: steps }, (_, i) => {
      const t = i / (steps - 1);
      return min + range * t;
    });
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-9 w-9"
          aria-label="Change background color"
        >
          <Palette className="h-4 w-4" />
        </Button>
        {onAnimationSettingsChange && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              "h-9 w-9",
              showAdvanced && "bg-accent"
            )}
            aria-label="Animation settings"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-12 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 w-64 max-h-[80vh] overflow-y-auto">
            <div className="text-sm font-medium mb-3 text-foreground">Background Color</div>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((preset, index) => {
                const isSelected =
                  JSON.stringify(preset.value) === JSON.stringify(selectedColors);
                return (
                  <button
                    key={index}
                    onClick={() => {
                      onColorChange(preset.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "aspect-square rounded-md border-2 transition-all hover:scale-110",
                      isSelected
                        ? "border-primary ring-2 ring-ring"
                        : "border-border hover:border-primary/50"
                    )}
                    style={{ backgroundColor: getColorPreview(preset.value) }}
                    aria-label={preset.name}
                    title={preset.name}
                  />
                );
              })}
            </div>
            <div className="mt-3 text-xs text-muted-foreground text-center">
              Click to apply
            </div>
          </div>
        </>
      )}

      {showAdvanced && onAnimationSettingsChange && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowAdvanced(false)}
          />
          <div className="absolute top-12 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg p-4 w-72">
            <div className="text-sm font-medium mb-4 text-foreground">Animation Settings</div>
            
            {/* Animation Speed */}
            <div className="mb-4">
              <label className="text-xs font-medium text-foreground mb-2 block">
                Animation Speed: {settings.animationSpeed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={settings.animationSpeed}
                onChange={(e) =>
                  handleSettingsChange("animationSpeed", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>

            {/* Opacity Range */}
            <div className="mb-4">
              <label className="text-xs font-medium text-foreground mb-2 block">
                Opacity Range: {settings.opacityMin.toFixed(1)} - {settings.opacityMax.toFixed(1)}
              </label>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min: {settings.opacityMin.toFixed(2)}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.opacityMin}
                    onChange={(e) =>
                      handleSettingsChange("opacityMin", parseFloat(e.target.value))
                    }
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max: {settings.opacityMax.toFixed(2)}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.opacityMax}
                    onChange={(e) =>
                      handleSettingsChange("opacityMax", parseFloat(e.target.value))
                    }
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>
            </div>

            {/* Dot Size */}
            <div className="mb-4">
              <label className="text-xs font-medium text-foreground mb-2 block">
                Dot Size: {settings.dotSize.toFixed(1)}px
              </label>
              <input
                type="range"
                min="1"
                max="6"
                step="0.5"
                value={settings.dotSize}
                onChange={(e) =>
                  handleSettingsChange("dotSize", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Small</span>
                <span>Large</span>
              </div>
            </div>

            {/* Hue */}
            <div className="mb-4">
              <label className="text-xs font-medium text-foreground mb-2 block">
                Hue: {settings.hue.toFixed(0)}°
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={settings.hue}
                onChange={(e) =>
                  handleSettingsChange("hue", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>-180°</span>
                <span>0°</span>
                <span>180°</span>
              </div>
            </div>

            {/* Saturation */}
            <div className="mb-4">
              <label className="text-xs font-medium text-foreground mb-2 block">
                Saturation: {(settings.saturation * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={settings.saturation}
                onChange={(e) =>
                  handleSettingsChange("saturation", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span>100%</span>
                <span>200%</span>
              </div>
            </div>

            {/* Contrast */}
            <div className="mb-4">
              <label className="text-xs font-medium text-foreground mb-2 block">
                Contrast: {settings.contrast.toFixed(2)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.01"
                value={settings.contrast}
                onChange={(e) =>
                  handleSettingsChange("contrast", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Low</span>
                <span>Normal</span>
                <span>High</span>
              </div>
            </div>

            {/* Glow */}
            <div className="mb-4">
              <label className="text-xs font-medium text-foreground mb-2 block">
                Glow: {(settings.glow * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.glow}
                onChange={(e) =>
                  handleSettingsChange("glow", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>None</span>
                <span>Medium</span>
                <span>Strong</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border">
              <button
                onClick={() => {
                  onAnimationSettingsChange(defaultSettings);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
