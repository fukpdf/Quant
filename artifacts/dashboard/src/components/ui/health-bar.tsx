import { cn } from "@/lib/utils";

interface HealthBarProps {
  value: number; // 0 to 100
  className?: string;
  showValue?: boolean;
}

export function HealthBar({ value, className, showValue = false }: HealthBarProps) {
  const normalizedValue = Math.min(Math.max(value, 0), 100);
  
  let colorClass = "bg-destructive";
  if (normalizedValue >= 90) colorClass = "bg-success";
  else if (normalizedValue >= 70) colorClass = "bg-warning";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div 
          className={cn("h-full transition-all duration-500", colorClass)} 
          style={{ width: `${normalizedValue}%` }} 
        />
      </div>
      {showValue && <span className="text-xs font-mono text-muted-foreground w-8 text-right">{Math.round(normalizedValue)}%</span>}
    </div>
  );
}
