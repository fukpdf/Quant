import { useState } from "react";
import {
  useGetLatestRankings,
  useListMarketRegimes,
  useGetActivePortfolioAllocation,
  useListStrategyClusters,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export default function StrategyRankingsPage() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "all_time">("monthly");
  const { data: rankings } = useGetLatestRankings({ period });
  const { data: regimes } = useListMarketRegimes();
  const { data: allocation } = useGetActivePortfolioAllocation();
  const { data: clusters } = useListStrategyClusters();

  const allocationData = allocation?.data as Record<string, unknown> | null | undefined;

  return (
    <div className="p-6">
      <PageHeader title="Strategy Rankings" subtitle="Intelligence and market regimes">
        <select
          className="bg-card border border-border rounded px-3 py-1.5 text-sm"
          value={period}
          onChange={(e) => setPeriod(e.target.value as typeof period)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="all_time">All Time</option>
        </select>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-3">
          <h3 className="text-lg font-medium mb-3">Leaderboard</h3>
          <DataTable
            data={rankings?.data || []}
            rowKey={(r) => r.id ?? r.strategyName ?? Math.random().toString()}
            columns={[
              {
                header: "#",
                cell: (_r, idx) => (
                  <span className="font-bold text-muted-foreground w-8 inline-block">{idx + 1}</span>
                ),
              },
              { header: "Strategy", accessorKey: "strategyName", className: "font-medium" },
              {
                header: "Score",
                cell: (r) => (
                  <span className="font-mono">{parseFloat(r.compositeScore ?? "0").toFixed(2)}</span>
                ),
              },
              {
                header: "Sharpe",
                cell: (r) =>
                  r.sharpeRatio != null
                    ? <span className="font-mono">{parseFloat(String(r.sharpeRatio)).toFixed(2)}</span>
                    : "—",
              },
              {
                header: "Win Rate",
                cell: (r) =>
                  r.winRate != null
                    ? `${(parseFloat(String(r.winRate)) * 100).toFixed(1)}%`
                    : "—",
              },
              {
                header: "Drawdown",
                cell: (r) =>
                  r.maxDrawdown != null ? (
                    <Badge variant="critical">
                      {parseFloat(String(r.maxDrawdown)).toFixed(1)}%
                    </Badge>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Period",
                cell: (r) => (
                  <span className="text-xs text-muted-foreground capitalize">
                    {r.rankingPeriod?.replace(/_/g, " ") ?? "—"}
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div className="space-y-6">
          <div className="p-4 rounded-md border border-border bg-card">
            <h3 className="text-sm font-medium mb-3 text-muted-foreground uppercase">
              Current Regime
            </h3>
            {regimes?.data?.[0] ? (
              <div>
                <div className="text-xl font-bold mb-2 capitalize">
                  {regimes.data[0].regimeType?.replace(/_/g, " ") ?? "Unknown"}
                </div>
                {regimes.data[0].confidenceScore != null && (
                  <div className="text-sm text-muted-foreground flex justify-between">
                    <span>Confidence</span>
                    <span className="font-mono">
                      {(parseFloat(String(regimes.data[0].confidenceScore)) * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                <div className="mt-2">
                  <Badge variant={regimes.data[0].status === "active" ? "healthy" : "warning"}>
                    {regimes.data[0].status ?? "unknown"}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No regime data</div>
            )}
          </div>

          {clusters?.data && clusters.data.length > 0 && (
            <div className="p-4 rounded-md border border-border bg-card">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground uppercase">
                Clusters
              </h3>
              <div className="space-y-2">
                {clusters.data.slice(0, 5).map((c: Record<string, unknown>) => (
                  <div key={c.id as string} className="flex justify-between text-sm">
                    <span className="truncate">{String(c.name ?? "—")}</span>
                    <span className="font-mono text-muted-foreground ml-2">
                      {String(c.size ?? "—")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allocationData && (
            <div className="p-4 rounded-md border border-border bg-card">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground uppercase">
                Active Allocation
              </h3>
              <div className="space-y-2 text-sm">
                {Object.entries(allocationData)
                  .filter(([, v]) => typeof v === "number")
                  .slice(0, 5)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="truncate">{k}</span>
                      <span className="font-mono">
                        {((v as number) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
