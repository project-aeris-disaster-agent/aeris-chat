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

  ({ className, variant, size, asChild = false, onClick, type, ...props }, ref) => {

    const Comp = asChild ? Slot : "button"

    // iOS fix: Add touch handler to ensure onClick fires on iOS
    // React's synthetic onClick doesn't always fire on iOS touch devices
    // IMPORTANT: Don't preventDefault for submit buttons - it blocks form submission!
    const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
      // For submit buttons, let the form handle submission naturally
      // Don't prevent default, as it will block form submission on iOS
      if (type === "submit") {
        // Let the form submit naturally - onClick will fire with the form submission
        return;
      }
      
      // For non-submit buttons, prevent default and call onClick
      e.preventDefault()
      if (onClick) {
        onClick(e as any)
      }
    }

    return (

      <Comp

        className={cn(buttonVariants({ variant, size, className }))}

        ref={ref}

        onClick={onClick}
        onTouchEnd={handleTouchEnd}
        type={type}

        {...props}

      />

    )

  },

)

Button.displayName = "Button"

export { Button, buttonVariants }

