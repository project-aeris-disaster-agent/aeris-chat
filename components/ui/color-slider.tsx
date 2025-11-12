"use client";

import React from "react";
import { Palette, SlidersHorizontal, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AnimationSettings {
  animationSpeed: number;
  opacityMin: number;
  opacityMax: number;
  dotSize: number;
  hue: number;
  saturation: number;
  contrast: number;
  glow: number;
  vibrance: number;
}

interface ColorSliderProps {
  selectedColors: number[][];
  onColorChange: (colors: number[][]) => void;
  animationSettings?: AnimationSettings;
  onAnimationSettingsChange?: (settings: AnimationSettings) => void;
  className?: string;
}

type ColorMode = "solid" | "gradient";

interface ColorStop {
  id: string;
  hue: number;
  saturation: number;
  lightness: number;
  position: number; // 0-100 for gradient position
}

export function ColorSlider({
  selectedColors,
  onColorChange,
  animationSettings,
  onAnimationSettingsChange,
  className,
}: ColorSliderProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [mode, setMode] = React.useState<ColorMode>(
    selectedColors.length > 1 ? "gradient" : "solid"
  );

  const defaultSettings: AnimationSettings = {
    animationSpeed: 0.5,
    opacityMin: 0.5,
    opacityMax: 1.0,
    dotSize: 6,
    hue: 0,
    saturation: 1.0,
    contrast: 1.0,
    glow: 0.0,
    vibrance: 0.0,
  };

  const settings = animationSettings || defaultSettings;

  // Convert RGB to HSL
  const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  };

  // Convert HSL to RGB
  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0,
      g = 0,
      b = 0;

    if (h >= 0 && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else if (h >= 300 && h < 360) {
      r = c;
      g = 0;
      b = x;
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  };

  // Initialize color stops from selectedColors
  const [colorStops, setColorStops] = React.useState<ColorStop[]>(() => {
    if (selectedColors.length > 1) {
      return selectedColors.map((color, index) => {
        const [r, g, b] = color;
        const [h, s, l] = rgbToHsl(r, g, b);
        return {
          id: `stop-${index}`,
          hue: h,
          saturation: s,
          lightness: l,
          position: (index / (selectedColors.length - 1)) * 100,
        };
      });
    } else if (selectedColors.length === 1) {
      const [r, g, b] = selectedColors[0];
      const [h, s, l] = rgbToHsl(r, g, b);
      return [
        {
          id: "stop-0",
          hue: h,
          saturation: s,
          lightness: l,
          position: 0,
        },
      ];
    }
    return [
      {
        id: "stop-0",
        hue: 200,
        saturation: 100,
        lightness: 70,
        position: 0,
      },
    ];
  });

  // Solid color state (for single color mode)
  const [solidColor, setSolidColor] = React.useState(() => {
    if (selectedColors.length > 0) {
      const [r, g, b] = selectedColors[0];
      return rgbToHsl(r, g, b);
    }
    return [200, 100, 70]; // Default sky blue
  });

  // Ref to track if we're updating from internal changes (to prevent infinite loop)
  const isInternalUpdateRef = React.useRef(false);
  const prevSelectedColorsRef = React.useRef<string>(JSON.stringify(selectedColors));

  // Sync with external selectedColors changes (only when changed externally)
  React.useEffect(() => {
    const currentSelectedStr = JSON.stringify(selectedColors);
    
    // Skip if this is an internal update or if colors haven't actually changed
    if (isInternalUpdateRef.current || prevSelectedColorsRef.current === currentSelectedStr) {
      isInternalUpdateRef.current = false;
      prevSelectedColorsRef.current = currentSelectedStr;
      return;
    }

    prevSelectedColorsRef.current = currentSelectedStr;

    if (selectedColors.length > 1 && mode === "gradient") {
      const newStops = selectedColors.map((color, index) => {
        const [r, g, b] = color;
        const [h, s, l] = rgbToHsl(r, g, b);
        return {
          id: `stop-${index}`,
          hue: h,
          saturation: s,
          lightness: l,
          position: (index / (selectedColors.length - 1)) * 100,
        };
      });
      setColorStops(newStops);
    } else if (selectedColors.length === 1 && mode === "solid") {
      const [r, g, b] = selectedColors[0];
      const newColor = rgbToHsl(r, g, b);
      setSolidColor(newColor);
    }
  }, [selectedColors, mode]);

  // Update colors when mode or color stops change
  React.useEffect(() => {
    isInternalUpdateRef.current = true;
    if (mode === "solid") {
      const [r, g, b] = hslToRgb(solidColor[0], solidColor[1], solidColor[2]);
      const newColors = [[r, g, b]];
      // Only call onColorChange if colors actually changed
      const currentStr = JSON.stringify(newColors);
      if (prevSelectedColorsRef.current !== currentStr) {
        prevSelectedColorsRef.current = currentStr;
        onColorChange(newColors);
      }
    } else {
      const colors = colorStops
        .sort((a, b) => a.position - b.position)
        .map((stop) => hslToRgb(stop.hue, stop.saturation, stop.lightness));
      const currentStr = JSON.stringify(colors);
      if (prevSelectedColorsRef.current !== currentStr) {
        prevSelectedColorsRef.current = currentStr;
        onColorChange(colors);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, solidColor, colorStops]);

  const handleSolidColorChange = (index: 0 | 1 | 2, value: number) => {
    const newColor = [...solidColor] as [number, number, number];
    newColor[index] = value;
    setSolidColor(newColor);
  };

  const handleColorStopChange = (
    id: string,
    field: keyof Omit<ColorStop, "id">,
    value: number
  ) => {
    setColorStops((stops) =>
      stops.map((stop) =>
        stop.id === id ? { ...stop, [field]: value } : stop
      )
    );
  };

  const addColorStop = () => {
    const newStop: ColorStop = {
      id: `stop-${Date.now()}`,
      hue: 200,
      saturation: 100,
      lightness: 70,
      position: 50,
    };
    setColorStops([...colorStops, newStop].sort((a, b) => a.position - b.position));
  };

  const removeColorStop = (id: string) => {
    if (colorStops.length > 2) {
      setColorStops(colorStops.filter((stop) => stop.id !== id));
    }
  };

  const getColorPreview = () => {
    if (mode === "solid") {
      const [r, g, b] = hslToRgb(solidColor[0], solidColor[1], solidColor[2]);
      return `rgb(${r}, ${g}, ${b})`;
    }
    // For gradient, create linear gradient CSS
    const sortedStops = [...colorStops].sort((a, b) => a.position - b.position);
    const gradientStops = sortedStops
      .map((stop) => {
        const [r, g, b] = hslToRgb(stop.hue, stop.saturation, stop.lightness);
        return `rgb(${r}, ${g}, ${b}) ${stop.position}%`;
      })
      .join(", ");
    return `linear-gradient(90deg, ${gradientStops})`;
  };

  const handleSettingsChange = (key: keyof AnimationSettings, value: number) => {
    if (onAnimationSettingsChange) {
      onAnimationSettingsChange({
        ...settings,
        [key]: value,
      });
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-9 w-9"
          aria-label="Change color"
        >
          <Palette className="h-4 w-4" />
        </Button>
        {onAnimationSettingsChange && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn("h-9 w-9", showAdvanced && "bg-accent")}
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
          <div className="absolute top-12 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg p-4 w-80 max-h-[80vh] overflow-y-auto">
            <div className="text-sm font-medium mb-3 text-foreground">Color Settings</div>

            {/* Mode Toggle */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setMode("solid")}
                className={cn(
                  "flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                  mode === "solid"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                Solid
              </button>
              <button
                onClick={() => setMode("gradient")}
                className={cn(
                  "flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                  mode === "gradient"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                Gradient
              </button>
            </div>

            {/* Color Preview */}
            <div className="mb-4">
              <div
                className="w-full h-12 rounded-md border-2 border-border"
                style={{ background: getColorPreview() }}
              />
            </div>

            {mode === "solid" ? (
              /* Solid Color Sliders */
              <div className="space-y-4">
                {/* Hue */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-2 block">
                    Hue: {solidColor[0]}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={solidColor[0]}
                    onChange={(e) =>
                      handleSolidColorChange(0, parseInt(e.target.value))
                    }
                    className="w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 via-purple-500 to-red-500 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, 
                        hsl(0, 100%, 50%), 
                        hsl(60, 100%, 50%), 
                        hsl(120, 100%, 50%), 
                        hsl(180, 100%, 50%), 
                        hsl(240, 100%, 50%), 
                        hsl(300, 100%, 50%), 
                        hsl(360, 100%, 50%))`,
                    }}
                  />
                </div>

                {/* Saturation */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-2 block">
                    Saturation: {solidColor[1]}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={solidColor[1]}
                    onChange={(e) =>
                      handleSolidColorChange(1, parseInt(e.target.value))
                    }
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Lightness */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-2 block">
                    Lightness: {solidColor[2]}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={solidColor[2]}
                    onChange={(e) =>
                      handleSolidColorChange(2, parseInt(e.target.value))
                    }
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Gradient Color Stops */
              <div className="space-y-4">
                {colorStops
                  .sort((a, b) => a.position - b.position)
                  .map((stop, index) => {
                    const [r, g, b] = hslToRgb(stop.hue, stop.saturation, stop.lightness);
                    return (
                      <div
                        key={stop.id}
                        className="p-3 border border-border rounded-md bg-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-foreground">
                            Color {index + 1}
                          </span>
                          {colorStops.length > 2 && (
                            <button
                              onClick={() => removeColorStop(stop.id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Color Preview */}
                        <div
                          className="w-full h-8 rounded-md border border-border mb-3"
                          style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
                        />

                        {/* Position (for gradient) */}
                        <div className="mb-3">
                          <label className="text-xs text-muted-foreground mb-1 block">
                            Position: {stop.position.toFixed(0)}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={stop.position}
                            onChange={(e) =>
                              handleColorStopChange(
                                stop.id,
                                "position",
                                parseInt(e.target.value)
                              )
                            }
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>

                        {/* Hue */}
                        <div className="mb-3">
                          <label className="text-xs text-muted-foreground mb-1 block">
                            Hue: {stop.hue}°
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            step="1"
                            value={stop.hue}
                            onChange={(e) =>
                              handleColorStopChange(
                                stop.id,
                                "hue",
                                parseInt(e.target.value)
                              )
                            }
                            className="w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 via-purple-500 to-red-500 rounded-lg appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, 
                                hsl(0, 100%, 50%), 
                                hsl(60, 100%, 50%), 
                                hsl(120, 100%, 50%), 
                                hsl(180, 100%, 50%), 
                                hsl(240, 100%, 50%), 
                                hsl(300, 100%, 50%), 
                                hsl(360, 100%, 50%))`,
                            }}
                          />
                        </div>

                        {/* Saturation */}
                        <div className="mb-3">
                          <label className="text-xs text-muted-foreground mb-1 block">
                            Saturation: {stop.saturation}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={stop.saturation}
                            onChange={(e) =>
                              handleColorStopChange(
                                stop.id,
                                "saturation",
                                parseInt(e.target.value)
                              )
                            }
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>

                        {/* Lightness */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            Lightness: {stop.lightness}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={stop.lightness}
                            onChange={(e) =>
                              handleColorStopChange(
                                stop.id,
                                "lightness",
                                parseInt(e.target.value)
                              )
                            }
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>
                      </div>
                    );
                  })}

                {/* Add Color Stop Button */}
                <button
                  onClick={addColorStop}
                  className="w-full py-2 border-2 border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-3 w-3" />
                  Add Color Stop
                </button>
              </div>
            )}
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
            <div className="text-sm font-medium mb-4 text-foreground">
              Animation Settings
            </div>

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
                Opacity Range: {settings.opacityMin.toFixed(1)} -{" "}
                {settings.opacityMax.toFixed(1)}
              </label>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Min: {settings.opacityMin.toFixed(2)}
                  </label>
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
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Max: {settings.opacityMax.toFixed(2)}
                  </label>
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

            {/* Vibrance */}
            <div className="mb-4">
              <label className="text-xs font-medium text-foreground mb-2 block">
                Vibrance: {(settings.vibrance * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.vibrance}
                onChange={(e) =>
                  handleSettingsChange("vibrance", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Neutral</span>
                <span>Enhanced</span>
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

