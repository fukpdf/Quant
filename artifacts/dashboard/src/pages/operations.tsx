import {
  useGetOpsOverview,
  useListSchedulerHealth,
  useListServiceHealth,
  useListPerformanceSnapshots,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { HealthBar } from "@/components/ui/health-bar";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function OperationsPage() {
  const { data: overview, isLoading: isLoadingOverview } = useGetOpsOverview();
  const { data: schedulersResponse, isLoading: isLoadingSchedulers } = useListSchedulerHealth();
  const { data: servicesResponse, isLoading: isLoadingServices } = useListServiceHealth();
  const { data: performanceResponse, isLoading: isLoadingPerformance } = useListPerformanceSnapshots();

  const schedulers = schedulersResponse?.data || [];
  const services = servicesResponse?.data || [];
  const snapshots = performanceResponse?.data || [];
  const platformScore = overview?.data?.platformScore ?? 0;

  return (
    <div className="p-6">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Platform health and scheduler status"
        isRefreshing={isLoadingOverview || isLoadingSchedulers || isLoadingServices}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="rounded-md border border-border bg-card p-6 flex flex-col justify-center items-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Platform Score</h3>
          <div className="relative h-32 w-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" className="text-muted stroke-2" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" className="text-primary stroke-2" strokeDasharray={`${platformScore} 283`} strokeDashoffset="0" />
            </svg>
            <span className="absolute text-3xl font-bold">{platformScore.toFixed(0)}</span>
          </div>
        </div>

        <div className="md:col-span-2 rounded-md border border-border bg-card p-4 flex flex-col">
          <h3 className="text-sm font-medium mb-4">Performance History (24h)</h3>
          <div className="flex-1 min-h-[150px]">
            {isLoadingPerformance ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshots.slice().reverse()}>
                  <XAxis dataKey="timestamp" tickFormatter={(v) => format(new Date(v), "HH:mm")} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="totalScore" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium mb-3">Service Health</h3>
          {isLoadingServices ? (
            <div className="text-sm text-muted-foreground p-4">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {services.map((service) => {
                const svcStatus = String(service.status ?? "unknown");
                const score = parseFloat(service.healthScore ?? "0");
                return (
                  <div key={service.id ?? service.service} className="p-4 rounded-md border border-border bg-card">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm capitalize">{service.service ?? service.id}</span>
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
                    <HealthBar value={score} showValue className="mt-4" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">Scheduler Health</h3>
          <DataTable
            data={schedulers}
            isLoading={isLoadingSchedulers}
            columns={[
              {
                header: "Scheduler",
                cell: (s) => <span className="font-medium">{s.schedulerName ?? "—"}</span>,
              },
              {
                header: "Status",
                cell: (s) => {
                  const st = String(s.status ?? "unknown");
                  return (
                    <Badge
                      variant={
                        st === "running"
                          ? "running"
                          : st === "failed"
                          ? "failed"
                          : "maintenance"
                      }
                    >
                      {st}
                    </Badge>
                  );
                },
              },
              {
                header: "Last Run",
                cell: (s) =>
                  s.lastRunAt ? format(new Date(s.lastRunAt), "HH:mm:ss") : "N/A",
              },
              {
                header: "Next Run",
                cell: (s) =>
                  s.nextRunAt ? format(new Date(s.nextRunAt), "HH:mm:ss") : "N/A",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
