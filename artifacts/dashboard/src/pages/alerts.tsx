import { useState } from "react";
import {
  useListAlertEvents,
  useAcknowledgeAlert,
  useResolveAlert,
  useListAlertRules,
  useUpdateAlertRule,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const { data: alertsResponse, isLoading: isLoadingAlerts } = useListAlertEvents(
    { status: filterStatus as any },
    { query: { refetchInterval: 30000 } as any }
  );
  const { data: rulesResponse, isLoading: isLoadingRules } = useListAlertRules();

  const ackAlert = useAcknowledgeAlert();
  const resAlert = useResolveAlert();
  const updateRule = useUpdateAlertRule();

  const alerts = alertsResponse?.data || [];
  const rules = rulesResponse?.data || [];

  const handleAck = (id: string) =>
    ackAlert.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries() });
  const handleResolve = (id: string) =>
    resAlert.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries() });

  return (
    <div className="p-6">
      <PageHeader title="Alert Management" subtitle="System alerts and monitoring rules" />

      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">Alert Events</h3>
          <select
            className="bg-card border border-border rounded px-3 py-1 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="">All</option>
          </select>
        </div>
        <DataTable
          data={alerts}
          isLoading={isLoadingAlerts}
          columns={[
            {
              header: "Severity",
              cell: (a) => <Badge variant={a.severity as any}>{a.severity}</Badge>,
            },
            {
              header: "Status",
              cell: (a) => <Badge variant="outline">{a.status}</Badge>,
            },
            {
              header: "Service",
              cell: (a) => <span>{a.service ?? "—"}</span>,
            },
            { header: "Title", accessorKey: "title" },
            {
              header: "Fired At",
              cell: (a) =>
                a.firedAt
                  ? format(new Date(a.firedAt), "MM/dd HH:mm:ss")
                  : a.createdAt
                  ? format(new Date(a.createdAt), "MM/dd HH:mm:ss")
                  : "—",
            },
            {
              header: "Actions",
              cell: (a) => (
                <div className="flex gap-2">
                  {a.status === "active" && (
                    <button
                      onClick={() => a.id && handleAck(a.id)}
                      className="text-xs bg-secondary px-2 py-1 rounded hover:bg-secondary/80"
                    >
                      Ack
                    </button>
                  )}
                  {a.status !== "resolved" && (
                    <button
                      onClick={() => a.id && handleResolve(a.id)}
                      className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/80"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Alert Rules</h3>
        <DataTable
          data={rules}
          isLoading={isLoadingRules}
          columns={[
            { header: "Name", accessorKey: "name" },
            {
              header: "Category",
              cell: (r) => (
                <span className="capitalize">{r.category ?? "—"}</span>
              ),
            },
            { header: "Condition", accessorKey: "condition" },
            {
              header: "Severity",
              cell: (r) => <Badge variant={r.severity as any}>{r.severity}</Badge>,
            },
            {
              header: "Status",
              cell: (r) => (
                <button
                  onClick={() =>
                    r.name &&
                    updateRule.mutate(
                      { name: r.name, data: { isEnabled: !r.isEnabled } },
                      { onSuccess: () => queryClient.invalidateQueries() }
                    )
                  }
                  className={`text-xs px-2 py-1 rounded ${
                    r.isEnabled
                      ? "bg-green-900/30 text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.isEnabled ? "Enabled" : "Disabled"}
                </button>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
