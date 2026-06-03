import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/contexts/auth-context";
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
  User,
  Users,
  Building2,
  Lock,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const mainNav = [
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

const adminNav = [
  { href: "/security", label: "Security", icon: Lock },
  { href: "/users", label: "Users", icon: Users },
  { href: "/org-settings", label: "Organization", icon: Building2 },
];

export function Sidebar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout, hasAnyPermission, isAuthenticated } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const canSeeAdmin = hasAnyPermission(["users:read", "operations:read"]);

  async function handleLogout() {
    await logout();
    toast.success("Signed out.");
  }

  const NavItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
    const active = location === href || (href !== "/" && location.startsWith(href));
    return (
      <li>
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
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar-background transition-all duration-300",
        collapsed ? "w-16" : "w-56",
      )}
    >
      {/* Header */}
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {mainNav.map(item => <NavItem key={item.href} {...item} />)}
        </ul>

        {canSeeAdmin && (
          <>
            {!collapsed && (
              <p className="mt-4 mb-1 px-4 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
                Admin
              </p>
            )}
            {collapsed && <div className="my-2 mx-2 border-t border-sidebar-border" />}
            <ul className="space-y-0.5 px-2">
              {adminNav.map(item => <NavItem key={item.href} {...item} />)}
            </ul>
          </>
        )}
      </nav>

      {/* Bottom — user + actions */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          data-testid="button-toggle-theme"
        >
          {theme === "dark" ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
          {!collapsed && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
        </button>

        {/* Profile */}
        {isAuthenticated && (
          <Link
            href="/profile"
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
              location === "/profile"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <User size={16} className="shrink-0" />
            {!collapsed && (
              <span className="truncate">{user?.firstName || user?.email?.split("@")[0] || "Profile"}</span>
            )}
          </Link>
        )}

        {/* Logout */}
        {isAuthenticated && (
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            data-testid="button-logout"
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
