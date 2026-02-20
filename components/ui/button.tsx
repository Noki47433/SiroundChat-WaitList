import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3FF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-[#00A3FF] text-white hover:bg-[#0091e3]",
        secondary: "bg-white/10 text-white hover:bg-white/15",
        outline: "border border-white/15 text-white hover:bg-white/5",
        ghost: "text-white/80 hover:bg-white/10 hover:text-white",
        subtle: "bg-white text-neutral-900 hover:bg-white/90",
        danger: "bg-red-500/90 text-white hover:bg-red-500"
      },
      size: {
        xs: "h-8 px-3 text-xs",
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-base"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";
