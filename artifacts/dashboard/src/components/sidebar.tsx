import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import {
  LayoutDashboard,
  Activity,
  Server,
  Bell,
  AlertTriangle,
  TrendingUp,
  Trophy,
  Shield,
  Zap,
  Radio,
  Brain,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/operations", label: "Operations", icon: Activity },
  { href: "/service-health", label: "Service Health", icon: Server },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/portfolio", label: "Portfolio", icon: TrendingUp },
  { href: "/strategy-rankings", label: "Rankings", icon: Trophy },
  { href: "/risk", label: "Risk", icon: Shield },
  { href: "/execution", label: "Execution", icon: Zap },
  { href: "/streaming", label: "Streaming", icon: Radio },
  { href: "/ai-insights", label: "AI Insights", icon: Brain },
];

export function Sidebar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar-background transition-all duration-300",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        {!collapsed && (
          <span className="text-sm font-semibold tracking-widest text-sidebar-primary uppercase">
            QuantForge
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto rounded p-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Toggle sidebar"
          data-testid="button-toggle-sidebar"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          data-testid="button-toggle-theme"
        >
          {theme === "dark" ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
          {!collapsed && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
        </button>
      </div>
    </aside>
  );
}
