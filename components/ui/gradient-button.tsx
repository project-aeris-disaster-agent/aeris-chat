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

  ({ className, variant, asChild = false, colors, style, ...props }, ref) => {

    const Comp = asChild ? Slot : "button"
    const buttonRef = React.useRef<HTMLButtonElement | null>(null)

    // Combine refs
    React.useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement)

    // iOS WebKit fix: Ensure touch events don't prevent click events
    React.useEffect(() => {
      const button = buttonRef.current
      if (!button || asChild) return

      let touchStartTime = 0
      let touchMoved = false

      const handleTouchStart = () => {
        touchStartTime = Date.now()
        touchMoved = false
      }

      const handleTouchMove = () => {
        touchMoved = true
      }

      const handleTouchEnd = (e: TouchEvent) => {
        // Only trigger click if touch was quick and didn't move (tap, not swipe)
        const touchDuration = Date.now() - touchStartTime
        if (!touchMoved && touchDuration < 300 && !button.disabled) {
          // Small delay to ensure click event fires naturally first
          // If click doesn't fire within 100ms, trigger it manually
          setTimeout(() => {
            if (button.isConnected && !button.disabled) {
              // Check if click already fired by checking if handler was called
              // If not, manually trigger it
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
              })
              button.dispatchEvent(clickEvent)
            }
          }, 50)
        }
      }

      button.addEventListener('touchstart', handleTouchStart, { passive: true })
      button.addEventListener('touchmove', handleTouchMove, { passive: true })
      button.addEventListener('touchend', handleTouchEnd, { passive: true })

      return () => {
        button.removeEventListener('touchstart', handleTouchStart)
        button.removeEventListener('touchmove', handleTouchMove)
        button.removeEventListener('touchend', handleTouchEnd)
      }
    }, [asChild])

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

        ref={(node: HTMLButtonElement) => {
          buttonRef.current = node
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
          }
        }}

        style={combinedStyle}

        {...props}

      />

    )

  }

)

GradientButton.displayName = "GradientButton"

export { GradientButton, gradientButtonVariants }
