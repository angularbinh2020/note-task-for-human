import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:brightness-110",
        secondary:
          "bg-[var(--color-muted)] text-[var(--color-foreground)] hover:bg-[#dce4ef]",
        outline:
          "border border-[var(--color-border)] bg-white hover:bg-[var(--color-muted)]",
        ghost: "hover:bg-[var(--color-muted)]",
        danger:
          "bg-[var(--color-danger)] text-[var(--color-danger-foreground)] hover:brightness-110",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5 text-xs",
        lg: "h-10 px-4",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
