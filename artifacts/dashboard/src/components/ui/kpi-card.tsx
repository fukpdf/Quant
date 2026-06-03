import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  delta?: string | number;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function KpiCard({ label, value, delta, trend, className }: KpiCardProps) {
  return (
    <div className={cn("rounded-md border border-border bg-card p-4 flex flex-col justify-between", className)}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-foreground tracking-tight">{value}</span>
        {delta !== undefined && (
          <span
            className={cn("text-xs font-medium", {
              "text-success": trend === "up",
              "text-destructive": trend === "down",
              "text-muted-foreground": trend === "neutral" || !trend,
            })}
          >
            {trend === "up" && "+"}
            {trend === "down" && "-"}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
