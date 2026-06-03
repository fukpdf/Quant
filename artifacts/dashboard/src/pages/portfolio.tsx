import {
  useListPaperAccounts,
  useGetPaperPortfolio,
  useGetPaperPerformance,
  useGetPortfolioHealth,
  useGetPortfolioAnalytics,
  useGetRecommendations,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export default function PortfolioPage() {
  const { data: accountsRes } = useListPaperAccounts();
  const accountId = accountsRes?.data?.[0]?.id ?? "";

  const { data: portfolio } = useGetPaperPortfolio(
    { accountId },
    { query: { enabled: !!accountId } as any }
  );
  const { data: performance } = useGetPaperPerformance(
    { accountId },
    { query: { enabled: !!accountId } as any }
  );
  const { data: health } = useGetPortfolioHealth(
    accountId,
    { query: { enabled: !!accountId } as any }
  );
  const { data: analytics } = useGetPortfolioAnalytics(
    accountId,
    { query: { enabled: !!accountId } as any }
  );
  const { data: recommendations } = useGetRecommendations(
    accountId,
    undefined,
    { query: { enabled: !!accountId } as any }
  );

  const pf = portfolio?.portfolio;
  const healthScore = health?.data?.overallScore;
  const sharpe = analytics?.data?.sharpeRatio;
  const maxDrawdown = performance?.metrics?.maxDrawdownPct;
  const recs = recommendations?.data ?? [];

  return (
    <div className="p-6">
      <PageHeader title="Portfolio Intelligence" subtitle="Analytics and performance metrics" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Exposure"
          value={pf?.totalExposure != null ? `$${parseFloat(pf.totalExposure).toLocaleString()}` : "N/A"}
        />
        <KpiCard
          label="Health Score"
          value={healthScore != null ? `${parseFloat(healthScore).toFixed(1)}/100` : "N/A"}
        />
        <KpiCard
          label="Sharpe Ratio"
          value={sharpe != null ? parseFloat(String(sharpe)).toFixed(2) : "N/A"}
        />
        <KpiCard
          label="Max Drawdown"
          value={maxDrawdown != null ? `${maxDrawdown.toFixed(2)}%` : "N/A"}
          trend="down"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-md border border-border bg-card p-4">
          <h3 className="text-sm font-medium mb-4 text-muted-foreground uppercase">
            Portfolio Summary
          </h3>
          {pf ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open Positions</span>
                <span className="font-mono">{pf.openPositions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Closed Positions</span>
                <span className="font-mono">{pf.closedPositions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Allocation</span>
                <span className="font-mono">{parseFloat(pf.allocationPct).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily Return</span>
                <span className={`font-mono ${parseFloat(pf.dailyReturnPct) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {parseFloat(pf.dailyReturnPct).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Drawdown</span>
                <span className="font-mono text-red-400">
                  {parseFloat(pf.currentDrawdownPct).toFixed(2)}%
                </span>
              </div>
              {health?.data?.grade && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Health Grade</span>
                  <Badge variant="healthy">{health.data.grade}</Badge>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {accountId ? "No portfolio data" : "No paper account found"}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">Recommendations</h3>
          <DataTable
            data={recs}
            emptyMessage="No recommendations"
            columns={[
              {
                header: "Type",
                cell: (r) => (
                  <span className="capitalize font-medium">{r.type}</span>
                ),
              },
              {
                header: "Severity",
                cell: (r) => (
                  <Badge
                    variant={
                      r.severity === "critical"
                        ? "critical"
                        : r.severity === "warning"
                        ? "warning"
                        : "info"
                    }
                  >
                    {r.severity}
                  </Badge>
                ),
              },
              {
                header: "Title",
                cell: (r) => (
                  <div>
                    <div className="font-medium text-xs">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">
                      {r.description}
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
