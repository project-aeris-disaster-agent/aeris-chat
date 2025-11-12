"use client"

import * as React from "react"

import { Slot } from "@radix-ui/react-slot"

import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Helper function to convert RGB array to hex color
const rgbToHex = (rgb: number[]): string => {
  return `#${rgb.map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')}`
}

const gradientButtonVariants = cva(

  [

    "gradient-button",

    "inline-flex items-center justify-center",

    "rounded-[11px] min-w-[132px] px-9 py-4",

    "text-base leading-[19px] font-[500] text-white",

    "font-sans font-bold",

    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",

    "disabled:pointer-events-none disabled:opacity-50",

    "cursor-pointer",

  ],

  {

    variants: {

      variant: {

        default: "",

        variant: "gradient-button-variant",

      },

    },

    defaultVariants: {

      variant: "default",

    },

  }

)

export interface GradientButtonProps

  extends React.ButtonHTMLAttributes<HTMLButtonElement>,

    VariantProps<typeof gradientButtonVariants> {

  asChild?: boolean
  colors?: number[][] // Array of RGB color arrays for dynamic gradient

}

const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(

  ({ className, variant, asChild = false, colors, style, onClick, ...props }, ref) => {

    const Comp = asChild ? Slot : "button"

    // iOS fix: Add touch handler to ensure onClick fires on iOS
    // React's synthetic onClick doesn't always fire on iOS touch devices
    const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (onClick) {
        onClick(e as any)
      }
    }

    // Generate CSS custom properties from colors
    const cssVars = React.useMemo(() => {
      if (!colors || colors.length === 0) {
        return {
          '--gradient-start': '#87CEEB',
          '--gradient-end': '#00dfd8',
        }
      }

      if (colors.length === 1) {
        const hex = rgbToHex(colors[0])
        return {
          '--gradient-start': hex,
          '--gradient-end': hex,
        }
      }

      // Multiple colors - use first and last for gradient
      return {
        '--gradient-start': rgbToHex(colors[0]),
        '--gradient-end': rgbToHex(colors[colors.length - 1]),
      }
    }, [colors])

    const combinedStyle = {
      ...cssVars,
      ...style,
    } as React.CSSProperties

    return (

      <Comp

        className={cn(gradientButtonVariants({ variant, className }))}

        ref={ref}

        style={combinedStyle}

        onClick={onClick}
        onTouchEnd={handleTouchEnd}

        {...props}

      />

    )

  }

)

GradientButton.displayName = "GradientButton"

export { GradientButton, gradientButtonVariants }
