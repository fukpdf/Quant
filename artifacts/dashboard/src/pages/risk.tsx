import {
  useGetKillSwitchStatus,
  useListCircuitBreakers,
  useListRiskViolations,
  useListDrawdownEvents,
  useListStrategyRiskScores,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

export default function RiskPage() {
  const { data: killSwitchRes } = useGetKillSwitchStatus();
  const { data: circuitBreakers } = useListCircuitBreakers();
  const { data: violations } = useListRiskViolations();
  const { data: drawdowns } = useListDrawdownEvents();
  const { data: strategyRiskScores } = useListStrategyRiskScores();

  const ks = killSwitchRes?.status;
  const isHalted = ks?.tradingHalted ?? false;
  const cbStates = circuitBreakers?.currentStates ?? [];
  const violationList = violations?.data ?? [];

  return (
    <div className="p-6">
      <PageHeader title="Risk Control Center" subtitle="Kill switch, circuit breakers, and violations" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div
          className={`p-6 rounded-md border flex flex-col items-center justify-center md:col-span-1 ${
            isHalted
              ? "border-destructive bg-destructive/10"
              : "border-green-800/30 bg-green-950/20"
          }`}
        >
          {isHalted ? (
            <ShieldAlert className="w-10 h-10 mb-2 text-destructive" />
          ) : (
            <ShieldCheck className="w-10 h-10 mb-2 text-green-500" />
          )}
          <h2 className="text-sm font-bold uppercase tracking-widest mb-1">Kill Switch</h2>
          <p
            className={`text-xs font-medium mb-3 ${
              isHalted ? "text-destructive" : "text-green-400"
            }`}
          >
            {isHalted ? "TRADING HALTED" : "ARMED"}
          </p>
          {ks?.schedulerPaused && (
            <div className="text-xs text-muted-foreground">Scheduler paused</div>
          )}
          {(ks?.haltedAccounts?.length ?? 0) > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {ks!.haltedAccounts.length} account(s) halted
            </div>
          )}
        </div>

        <div className="md:col-span-3 grid grid-cols-3 gap-4">
          <KpiCard
            label="Tripped Breakers"
            value={cbStates.filter((s) => s.state === "triggered").length}
          />
          <KpiCard label="Total Violations" value={violations?.total ?? 0} />
          <KpiCard label="Strategy Scores" value={strategyRiskScores?.data?.length ?? 0} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-lg font-medium mb-3">Circuit Breakers</h3>
          <DataTable
            data={cbStates}
            emptyMessage="No circuit breakers"
            columns={[
              {
                header: "Type",
                cell: (cb) => (
                  <span className="capitalize font-medium">
                    {cb.type.replace(/_/g, " ")}
                  </span>
                ),
              },
              {
                header: "State",
                cell: (cb) => {
                  const st = String(cb.state);
                  return (
                    <Badge
                      variant={
                        st === "triggered"
                          ? "emergency"
                          : st === "recovering"
                          ? "warning"
                          : st === "active"
                          ? "healthy"
                          : "secondary"
                      }
                    >
                      {st}
                    </Badge>
                  );
                },
              },
              {
                header: "Strategy",
                cell: (cb) => cb.strategyName ?? "—",
              },
              {
                header: "Triggered At",
                cell: (cb) =>
                  cb.triggeredAt
                    ? format(new Date(cb.triggeredAt), "MM/dd HH:mm")
                    : "—",
              },
            ]}
          />
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">Recent Violations</h3>
          <DataTable
            data={violationList.slice(0, 10)}
            emptyMessage="No violations"
            columns={[
              {
                header: "Severity",
                cell: (v) => (
                  <Badge
                    variant={
                      v.severity === "critical"
                        ? "critical"
                        : v.severity === "warning"
                        ? "warning"
                        : "info"
                    }
                  >
                    {v.severity}
                  </Badge>
                ),
              },
              {
                header: "Rule Type",
                cell: (v) => (
                  <span className="capitalize">{v.ruleType.replace(/_/g, " ")}</span>
                ),
              },
              {
                header: "Description",
                cell: (v) => (
                  <span className="text-xs line-clamp-1">{v.description}</span>
                ),
              },
              {
                header: "Strategy",
                cell: (v) => v.strategyName ?? "—",
              },
            ]}
          />
        </div>
      </div>

      {(drawdowns?.data?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Drawdown Events</h3>
          <DataTable
            data={drawdowns?.data ?? []}
            columns={[
              {
                header: "Account",
                cell: (d) => <span className="font-mono text-xs">{d.accountId}</span>,
              },
              {
                header: "Event Type",
                cell: (d) => (
                  <span className="capitalize">{String(d.eventType).replace(/_/g, " ")}</span>
                ),
              },
              {
                header: "Drawdown %",
                cell: (d) => (
                  <span className="text-red-400 font-mono">
                    {parseFloat(d.drawdownPct).toFixed(2)}%
                  </span>
                ),
              },
              {
                header: "Action",
                cell: (d) => (
                  <span className="capitalize text-xs">{String(d.action).replace(/_/g, " ")}</span>
                ),
              },
              {
                header: "Resolved",
                cell: (d) => (
                  <Badge variant={d.resolved ? "healthy" : "warning"}>
                    {d.resolved ? "Yes" : "No"}
                  </Badge>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
