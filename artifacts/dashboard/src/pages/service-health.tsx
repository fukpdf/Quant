import { useState } from "react";
import { useListServiceHealth, useGetServiceHealthHistory } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type StatusVariant = "healthy" | "warning" | "failed";

function statusVariant(status: string | undefined): StatusVariant {
  if (status === "healthy") return "healthy";
  if (status === "degraded") return "warning";
  return "failed";
}

export default function ServiceHealthPage() {
  const { data: servicesResponse, isLoading: isLoadingServices } = useListServiceHealth();
  const services = servicesResponse?.data || [];
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const { data: historyResponse, isLoading: isLoadingHistory } = useGetServiceHealthHistory(
    selectedServiceId || "",
    undefined,
    { query: { enabled: !!selectedServiceId } as any }
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Service Health"
        subtitle="Detailed service status and failure history"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h3 className="text-lg font-medium mb-3">Services</h3>
          <DataTable
            data={services}
            isLoading={isLoadingServices}
            onRowClick={(service) => setSelectedServiceId(service.id ?? null)}
            rowKey={(s) => s.id ?? s.service ?? Math.random().toString()}
            columns={[
              { header: "Service", accessorKey: "service", className: "font-medium capitalize" },
              {
                header: "Score",
                cell: (s) => (
                  <span className="font-mono">
                    {parseFloat(s.healthScore ?? "0").toFixed(0)}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (s) => (
                  <Badge variant={statusVariant(s.status)}>
                    {s.status ?? "unknown"}
                  </Badge>
                ),
              },
              {
                header: "Failures",
                cell: (s) => {
                  const failures = parseInt(s.consecutiveFailures ?? "0", 10);
                  return failures > 0 ? (
                    <span className="text-destructive font-bold">{failures}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  );
                },
              },
              {
                header: "Last Success",
                cell: (s) =>
                  s.lastSuccessAt
                    ? format(new Date(s.lastSuccessAt), "MM/dd HH:mm")
                    : <span className="text-muted-foreground">N/A</span>,
              },
            ]}
          />
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">History</h3>
          {!selectedServiceId ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-md text-sm">
              Select a service row to view history
            </div>
          ) : (
            <DataTable
              data={historyResponse?.data || []}
              isLoading={isLoadingHistory}
              rowKey={(h) => h.id ?? h.createdAt ?? Math.random().toString()}
              columns={[
                {
                  header: "Time",
                  cell: (h) =>
                    h.createdAt
                      ? format(new Date(h.createdAt), "HH:mm:ss")
                      : "—",
                },
                {
                  header: "Score",
                  cell: (h) => (
                    <span className="font-mono">
                      {parseFloat(h.healthScore ?? "0").toFixed(0)}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  cell: (h) => (
                    <Badge variant={statusVariant(h.status)}>
                      {h.status ?? "unknown"}
                    </Badge>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
