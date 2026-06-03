import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "text-foreground",
        healthy: "border-transparent bg-success/20 text-success hover:bg-success/30",
        running: "border-transparent bg-success/20 text-success hover:bg-success/30",
        degraded: "border-transparent bg-warning/20 text-warning hover:bg-warning/30",
        warning: "border-transparent bg-warning/20 text-warning hover:bg-warning/30",
        failed: "border-transparent bg-destructive/20 text-destructive hover:bg-destructive/30",
        critical: "border-transparent bg-destructive/20 text-destructive hover:bg-destructive/30",
        emergency: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 uppercase tracking-wider font-bold",
        maintenance: "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        info: "border-transparent bg-info/20 text-info hover:bg-info/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
