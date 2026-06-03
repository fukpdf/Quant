import { useQuery } from "@tanstack/react-query";
import { apiListSecurityEvents, apiListAuditEvents } from "@/lib/auth-client";
import { useAuth } from "@/contexts/auth-context";
import { Link } from "wouter";

const SEVERITY_COLOR: Record<string, string> = {
  info: "text-blue-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

const EVENT_ICONS: Record<string, string> = {
  login_success: "✅",
  login_failure: "❌",
  logout: "🚪",
  password_change: "🔑",
  password_reset_request: "📧",
  password_reset_complete: "🔑",
  account_locked: "🔒",
  session_revoked: "🚫",
  api_key_created: "🗝️",
  api_key_revoked: "🗑️",
  role_assigned: "👤",
  brute_force_detected: "⚠️",
  invitation_sent: "✉️",
  invitation_accepted: "🤝",
};

export default function SecurityDashboardPage() {
  const { hasPermission } = useAuth();
  const canViewAll = hasPermission("operations:read");

  const { data: secEvents, isLoading: loadingSec } = useQuery({
    queryKey: ["security-events", canViewAll],
    queryFn: () => apiListSecurityEvents({ limit: 50 }) as Promise<{ data: any[]; total: number }>,
    refetchInterval: 30000,
  });

  const { data: auditEvents, isLoading: loadingAudit } = useQuery({
    queryKey: ["audit-events"],
    queryFn: () => apiListAuditEvents({ limit: 50 }) as Promise<{ data: any[]; total: number }>,
    enabled: canViewAll,
    refetchInterval: 30000,
  });

  const events = secEvents?.data ?? [];
  const audits = auditEvents?.data ?? [];

  const criticalCount = events.filter((e: any) => e.severity === "critical").length;
  const warningCount = events.filter((e: any) => e.severity === "warning").length;
  const failedLogins = events.filter((e: any) => e.eventType === "login_failure").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Security Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor security events and audit trail.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Critical Events", value: criticalCount, color: "text-red-400" },
          { label: "Warnings", value: warningCount, color: "text-amber-400" },
          { label: "Failed Logins", value: failedLogins, color: "text-orange-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Security Events */}
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-semibold text-foreground">Security Events</h2>
            <span className="text-xs text-muted-foreground">{events.length} events</span>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {loadingSec && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
            {!loadingSec && events.length === 0 && <p className="p-4 text-sm text-muted-foreground">No security events.</p>}
            {events.map((ev: any) => (
              <div key={ev.id} className="px-5 py-3 flex items-start gap-3">
                <span className="text-lg shrink-0">{EVENT_ICONS[ev.eventType] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-foreground">{ev.eventType}</span>
                    <span className={`text-xs font-medium ${SEVERITY_COLOR[ev.severity] ?? "text-muted-foreground"}`}>{ev.severity}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ev.ipAddress ? `${ev.ipAddress} · ` : ""}{new Date(ev.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Audit Trail */}
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-semibold text-foreground">Audit Trail</h2>
            <span className="text-xs text-muted-foreground">{audits.length} entries</span>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {!canViewAll && <p className="p-4 text-sm text-muted-foreground">Requires operations:read permission.</p>}
            {canViewAll && loadingAudit && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
            {canViewAll && !loadingAudit && audits.length === 0 && <p className="p-4 text-sm text-muted-foreground">No audit entries.</p>}
            {audits.map((ev: any) => (
              <div key={ev.id} className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-foreground">{ev.action}</span>
                  <span className="text-xs text-muted-foreground">on</span>
                  <span className="text-xs font-mono text-primary">{ev.resource}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ev.actorEmail ?? "System"} · {new Date(ev.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
