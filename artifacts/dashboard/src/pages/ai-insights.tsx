import { 
  useListAiHealth, 
  useListAiInsights, 
  useAcknowledgeAiInsight, 
  useGenerateAiInsights, 
  useListAiSummaries, 
  useGeneratePortfolioSummary, 
  useGenerateStrategySummary, 
  useGenerateRiskSummary, 
  useListAiReports, 
  useGetAiUsageSummary 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { format } from "date-fns";

export default function AiInsightsPage() {
  const queryClient = useQueryClient();
  const { data: health } = useListAiHealth();
  const { data: insights, isLoading: isLoadingInsights } = useListAiInsights();
  const { data: usage } = useGetAiUsageSummary();
  const { data: reports, isLoading: isLoadingReports } = useListAiReports();

  const generatePortfolio = useGeneratePortfolioSummary();
  const generateStrategy = useGenerateStrategySummary();
  const generateRisk = useGenerateRiskSummary();
  const ackInsight = useAcknowledgeAiInsight();

  const handleAck = (id: string) => ackInsight.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries() });

  return (
    <div className="p-6">
      <PageHeader title="AI Insights" subtitle="Research assistant and automated intelligence" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Tokens" value={(usage?.data?.totalTokens || 0).toLocaleString()} />
        <KpiCard label="Total Requests" value={(usage?.data?.totalRequests || 0).toLocaleString()} />
        <KpiCard label="Active Provider" value={usage?.data?.activeProvider ?? "—"} />
        
        <div className="p-4 rounded-md border border-border bg-card flex flex-col justify-center">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Providers Status</h3>
          <div className="flex gap-2">
            {health?.data?.slice(0, 3).map((h: any) => (
              <Badge key={h.id} variant={h.status === "healthy" ? "healthy" : "warning"}>{h.providerName}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium">Insights Feed</h3>
          </div>
          <div className="space-y-4">
            {insights?.data?.map((insight: any) => (
              <div key={insight.id} className="p-4 rounded-md border border-border bg-card">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2 items-center">
                    <Badge variant={insight.severity === "high" ? "critical" : insight.severity === "medium" ? "warning" : "info"}>{insight.severity}</Badge>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{insight.category}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{format(new Date(insight.createdAt), "MM/dd HH:mm")}</span>
                </div>
                <h4 className="font-medium mb-1">{insight.title}</h4>
                <p className="text-sm text-muted-foreground mb-3">{insight.content}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-mono">Conf: {(insight.confidenceScore * 100).toFixed(0)}%</span>
                  {!insight.acknowledgedAt && (
                    <button 
                      onClick={() => handleAck(insight.id)}
                      className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded hover:bg-secondary/80"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(!insights?.data || insights.data.length === 0) && !isLoadingInsights && (
              <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-md">
                No active insights
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium">Generate Reports</h3>
          </div>
          <div className="flex gap-3 mb-6">
            <button 
              onClick={() => generatePortfolio.mutate({ data: { accountId: "default" } }, { onSuccess: () => queryClient.invalidateQueries() })}
              disabled={generatePortfolio.isPending}
              className="flex-1 bg-primary text-primary-foreground py-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Portfolio Summary
            </button>
            <button 
              onClick={() => generateStrategy.mutate({ data: { strategyName: "default" } }, { onSuccess: () => queryClient.invalidateQueries() })}
              disabled={generateStrategy.isPending}
              className="flex-1 bg-primary text-primary-foreground py-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Strategy Summary
            </button>
            <button 
              onClick={() => generateRisk.mutate({}, { onSuccess: () => queryClient.invalidateQueries() })}
              disabled={generateRisk.isPending}
              className="flex-1 bg-primary text-primary-foreground py-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Risk Summary
            </button>
          </div>

          <h3 className="text-lg font-medium mb-3">Recent Reports</h3>
          <DataTable 
            data={reports?.data || []}
            isLoading={isLoadingReports}
            columns={[
              { header: "Type", accessorKey: "reportType", className: "capitalize" },
              { header: "Status", cell: (r) => <Badge variant={r.status === "completed" ? "healthy" : "warning"}>{r.status}</Badge> },
              { header: "Created", cell: (r) => format(new Date(r.createdAt), "MM/dd HH:mm") }
            ]}
          />
        </div>
      </div>
    </div>
  );
}
