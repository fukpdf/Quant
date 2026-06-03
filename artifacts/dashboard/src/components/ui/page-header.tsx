import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, onRefresh, isRefreshing, className, children }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center rounded-md border border-border bg-card p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Refresh data"
          >
            <RefreshCw size={16} className={cn({ "animate-spin": isRefreshing })} />
          </button>
        )}
      </div>
    </div>
  );
}
