import * as React from "react"

import { Slot } from "@radix-ui/react-slot"

import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(

  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",

  {

    variants: {

      variant: {

        default: "bg-primary text-primary-foreground hover:bg-primary/90",

        destructive:

          "bg-destructive text-destructive-foreground hover:bg-destructive/90",

        outline:

          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",

        secondary:

          "bg-secondary text-secondary-foreground hover:bg-secondary/80",

        ghost: "hover:bg-accent hover:text-accent-foreground",

        link: "text-primary underline-offset-4 hover:underline",

      },

      size: {

        default: "h-10 px-4 py-2",

        sm: "h-9 rounded-md px-3",

        lg: "h-11 rounded-md px-8",

        icon: "h-10 w-10",

      },

    },

    defaultVariants: {

      variant: "default",

      size: "default",

    },

  },

)

export interface ButtonProps

  extends React.ButtonHTMLAttributes<HTMLButtonElement>,

    VariantProps<typeof buttonVariants> {

  asChild?: boolean

}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(

  ({ className, variant, size, asChild = false, ...props }, ref) => {

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

    return (

      <Comp

        className={cn(buttonVariants({ variant, size, className }))}

        ref={(node: HTMLButtonElement) => {
          buttonRef.current = node
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
          }
        }}

        {...props}

      />

    )

  },

)

Button.displayName = "Button"

export { Button, buttonVariants }

