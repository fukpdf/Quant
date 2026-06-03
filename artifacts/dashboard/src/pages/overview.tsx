import {
  useGetOpsOverview,
  useGetLiveSystemMetrics,
  useListAlertEvents,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { HealthBar } from "@/components/ui/health-bar";
import { Activity, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function OverviewPage() {
  const { data: overview, isLoading: isLoadingOverview } = useGetOpsOverview();
  const { data: metrics, isLoading: isLoadingMetrics } = useGetLiveSystemMetrics(
    { query: { refetchInterval: 10000 } as any }
  );
  const { data: alertsResponse, isLoading: isLoadingAlerts } = useListAlertEvents(
    undefined,
    { query: { refetchInterval: 30000 } as any }
  );

  const alerts = alertsResponse?.data || [];
  const ops = overview?.data;
  const sysMetrics = metrics?.data as Record<string, unknown> | undefined;

  function getMetricPct(key: string): number {
    const val = sysMetrics?.[key];
    if (typeof val === "number") return val;
    if (val && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (typeof obj.usagePercent === "number") return obj.usagePercent;
      if (typeof obj.percent === "number") return obj.percent;
    }
    return 0;
  }

  const cpuPct = getMetricPct("cpu");
  const memPct = getMetricPct("memory");
  const heapPct = getMetricPct("heap");

  return (
    <div className="p-6">
      <PageHeader
        title="Command Center"
        subtitle="Cross-platform operations overview"
        isRefreshing={isLoadingOverview || isLoadingMetrics}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Platform Score"
          value={ops?.platformScore != null ? `${ops.platformScore.toFixed(1)}/100` : "N/A"}
          trend={ops?.platformScore != null && ops.platformScore > 90 ? "up" : ops?.platformScore != null && ops.platformScore < 70 ? "down" : "neutral"}
        />
        <KpiCard
          label="Active Alerts"
          value={ops?.activeAlerts ?? 0}
          trend={(ops?.activeAlerts ?? 0) > 0 ? "down" : "neutral"}
        />
        <KpiCard
          label="Open Incidents"
          value={ops?.openIncidents ?? 0}
          trend={(ops?.openIncidents ?? 0) > 0 ? "down" : "neutral"}
        />
        <KpiCard
          label="Degraded Services"
          value={`${ops?.degradedServices ?? 0} / ${ops?.totalServices ?? 0}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-md border border-border bg-card p-4">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Activity size={16} /> System Metrics
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "CPU Usage", value: cpuPct },
                { label: "Memory Usage", value: memPct },
                { label: "Heap Usage", value: heapPct },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <div className="text-lg font-mono mb-2">{value.toFixed(1)}%</div>
                  <HealthBar value={value} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Service Health Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {((ops?.services ?? []) as Record<string, unknown>[]).slice(0, 4).map((service) => {
                const svcName = String(service.name ?? service.service ?? "unknown");
                const svcStatus = String(service.status ?? "unknown");
                const uptime = typeof service.uptimePercentage === "number"
                  ? service.uptimePercentage.toFixed(2)
                  : null;
                return (
                  <div
                    key={svcName}
                    className="flex items-center justify-between p-4 rounded-md border border-border bg-card"
                  >
                    <div>
                      <div className="font-medium capitalize">{svcName}</div>
                      {uptime && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Uptime: {uptime}%
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={
                        svcStatus === "healthy"
                          ? "healthy"
                          : svcStatus === "degraded"
                          ? "warning"
                          : "failed"
                      }
                    >
                      {svcStatus}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <AlertTriangle size={18} /> Recent Alerts
          </h3>
          <DataTable
            data={alerts.slice(0, 8)}
            isLoading={isLoadingAlerts}
            columns={[
              {
                header: "Alert",
                cell: (alert) => (
                  <div>
                    <div className="font-medium text-xs mb-1">{alert.title ?? "Alert"}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {alert.firedAt
                        ? format(new Date(alert.firedAt), "HH:mm:ss")
                        : alert.createdAt
                        ? format(new Date(alert.createdAt), "HH:mm:ss")
                        : "—"}
                    </div>
                  </div>
                ),
              },
              {
                header: "Sev",
                className: "w-20",
                cell: (alert) => (
                  <Badge
                    variant={
                      alert.severity === "critical" || alert.severity === "emergency"
                        ? "critical"
                        : alert.severity === "warning"
                        ? "warning"
                        : "info"
                    }
                  >
                    {alert.severity ?? "info"}
                  </Badge>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
