import {
  useGetExecutionHealth,
  useGetV1ExecutionOrders,
  useGetV1ExecutionPositions,
} from "@workspace/api-client-react";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";

export default function ExecutionPage() {
  const [windowVal, setWindowVal] = useState("1h");
  const { data: healthResp } = useGetExecutionHealth({ window: windowVal as any });
  const { data: orders } = useGetV1ExecutionOrders();
  const { data: positions } = useGetV1ExecutionPositions();

  const health = healthResp?.data;
  const fillRate = parseFloat(health?.fillRate ?? "0");
  const rejectionRate = parseFloat(health?.rejectionRate ?? "0");
  const avgLatency = parseFloat(health?.avgLatencyMs ?? "0");
  const p95Latency = parseFloat(health?.p95LatencyMs ?? "0");

  return (
    <div className="p-6">
      <PageHeader title="Execution Engine" subtitle="Order flow, fills, and latency">
        <select
          className="bg-card border border-border rounded px-3 py-1.5 text-sm"
          value={windowVal}
          onChange={(e) => setWindowVal(e.target.value)}
        >
          <option value="1h">1 Hour</option>
          <option value="4h">4 Hours</option>
          <option value="1d">1 Day</option>
        </select>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Fill Rate" value={`${fillRate.toFixed(1)}%`} />
        <KpiCard label="Rejection Rate" value={`${rejectionRate.toFixed(1)}%`} />
        <KpiCard label="Avg Latency" value={`${avgLatency.toFixed(0)}ms`} />
        <KpiCard label="P95 Latency" value={`${p95Latency.toFixed(0)}ms`} />
      </div>

      {health && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Orders" value={health.totalOrders ?? 0} />
          <KpiCard label="Filled" value={health.filledOrders ?? 0} />
          <KpiCard label="Rejected" value={health.rejectedOrders ?? 0} />
          <KpiCard label="Cancelled" value={health.cancelledOrders ?? 0} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium mb-3">Active Positions</h3>
          <DataTable
            data={positions?.data || []}
            columns={[
              { header: "Symbol", accessorKey: "symbol", className: "font-medium" },
              {
                header: "Side",
                cell: (p) => (
                  <Badge variant={p.side === "long" ? "healthy" : "failed"}>
                    {p.side}
                  </Badge>
                ),
              },
              { header: "Qty", accessorKey: "quantity" },
              { header: "Avg Entry", accessorKey: "avgEntryPrice" },
              {
                header: "Unrealized P&L",
                cell: (p) => {
                  const pnl = parseFloat(p.unrealizedPnl ?? "0");
                  return (
                    <span className={pnl >= 0 ? "text-green-400 font-mono" : "text-red-400 font-mono"}>
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                    </span>
                  );
                },
              },
            ]}
          />
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">Recent Orders</h3>
          <DataTable
            data={orders?.data?.slice(0, 10) || []}
            columns={[
              { header: "Symbol", accessorKey: "symbol" },
              {
                header: "Side",
                cell: (o) => (
                  <span className={String(o.side) === "buy" ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                    {String(o.side ?? "—").toUpperCase()}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (o) => {
                  const st = String(o.status ?? "");
                  return (
                    <Badge
                      variant={
                        st === "filled"
                          ? "healthy"
                          : st === "rejected" || st === "failed"
                          ? "failed"
                          : "outline"
                      }
                    >
                      {st}
                    </Badge>
                  );
                },
              },
              {
                header: "Qty",
                cell: (o) =>
                  `${o.filledQuantity || "0"}/${o.quantity || "0"}`,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
