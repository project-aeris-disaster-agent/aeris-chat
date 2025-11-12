"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AnimatedBlobsProps {
  colors?: number[][];
  className?: string;
  size?: number | string;
  speedSeconds?: number;
  blur?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const rgbToCss = (rgb: number[]) => {
  const [r, g, b] = rgb;
  return `rgb(${clamp(Math.round(r), 0, 255)}, ${clamp(Math.round(g), 0, 255)}, ${clamp(
    Math.round(b),
    0,
    255
  )})`;
};

const adjustChannel = (value: number, amount: number) =>
  clamp(value + amount, 0, 255);

const createGradient = (rgb: number[], amount: number) => {
  const [r, g, b] = rgb;
  const lighter = `rgb(${adjustChannel(r, amount)}, ${adjustChannel(
    g,
    amount
  )}, ${adjustChannel(b, amount)})`;
  const darker = `rgb(${adjustChannel(r, -amount)}, ${adjustChannel(
    g,
    -amount
  )}, ${adjustChannel(b, -amount)})`;
  const base = rgbToCss(rgb);
  return `linear-gradient(${base}, ${lighter}, ${base}), linear-gradient(${base}, ${darker}, ${base})`;
};

const defaultPalette: number[][] = [
  [0, 116, 217],
  [255, 65, 54],
  [61, 153, 112],
  [177, 13, 201],
];

export function AnimatedBlobs({
  colors,
  className,
  size = "16rem",
  speedSeconds = 6,
  blur = "1.2vmin",
}: AnimatedBlobsProps) {
  const palette = React.useMemo(() => {
    if (colors && colors.length > 0) {
      return [...colors, ...colors, ...colors, ...colors].slice(0, 4);
    }
    return defaultPalette;
  }, [colors]);

  const blobs = React.useMemo(() => {
    const baseTransforms = [
      "rotate(30deg) scale(1.03)",
      "rotate(60deg) scale(0.95)",
      "rotate(90deg) scale(0.97)",
      "rotate(120deg) scale(1.02)",
    ];
    return palette.map((rgb, index) => {
      const backgroundColor = rgbToCss(rgb);
      const gradient = createGradient(rgb, 48);
      return {
        backgroundColor,
        backgroundImage: gradient,
        transform: baseTransforms[index % baseTransforms.length],
      };
    });
  }, [palette]);

  const blobStyle: React.CSSProperties = React.useMemo(
    () => ({
      "--border-radius": "115% 140% 145% 110% / 125% 140% 110% 125%",
      "--border-width": "4vmin",
      aspectRatio: "1",
      display: "block",
      gridArea: "stack",
      backgroundSize: "calc(100% + var(--border-width) * 2)",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
      border: "var(--border-width) solid transparent",
      borderRadius: "var(--border-radius)" as React.CSSProperties["borderRadius"],
      maskImage: "linear-gradient(transparent, transparent), linear-gradient(black, white)",
      maskClip: "padding-box, border-box",
      maskComposite: "intersect",
      mixBlendMode: "screen",
      width: typeof size === "number" ? `${size}px` : size,
      height: typeof size === "number" ? `${size}px` : size,
      filter: `blur(${blur})`,
    }),
    [size, blur]
  );

  return (
    <div className={cn("relative flex items-center justify-center overflow-visible", className)}>
      <div className="grid" style={{ gridTemplateAreas: "'stack'" }}>
        <div
          className="grid relative"
          style={{
            gridTemplateAreas: "'stack'",
            gridArea: "stack",
            animation: `blob-spin ${speedSeconds}s linear infinite`,
          }}
        >
          {blobs.map((blob, index) => (
            <span
              key={`blob-${index}`}
              style={{
                ...blobStyle,
                ...blob,
              }}
            />
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes blob-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

