import {
  useGetStreamStatus,
  useGetStreamProviders,
  useGetStreamSessions,
  useGetStreamLatency,
  useListStreamHealthHistory,
  useGetMarketState,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function StreamingPage() {
  const { data: statusResp, isLoading: isLoadingStatus } = useGetStreamStatus(
    { query: { refetchInterval: 15000 } as any }
  );
  const { data: providers } = useGetStreamProviders();
  const { data: sessions, isLoading: isLoadingSessions } = useGetStreamSessions();
  const { data: _latency } = useGetStreamLatency();
  const { data: _streamHealth } = useListStreamHealthHistory();
  const { data: marketStateResp } = useGetMarketState(
    { symbol: "BTCUSDT" },
    { query: { refetchInterval: 15000 } as any }
  );

  const streamStatus = statusResp?.data;
  const availableProviders = providers?.data?.available ?? [];
  const msRaw = marketStateResp?.data;
  const ms = Array.isArray(msRaw) ? msRaw[0] : msRaw;
  const msStatus = ms ? String(ms.marketStatus) : null;

  return (
    <div className="p-6">
      <PageHeader
        title="Streaming Infrastructure"
        subtitle="Market data ingestion and connectivity"
        isRefreshing={isLoadingStatus}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Stream Active"
          value={streamStatus?.streaming ? "Active" : "Offline"}
        />
        <KpiCard
          label="Ticks Received"
          value={streamStatus?.ticksReceived?.toLocaleString() ?? "0"}
        />
        <KpiCard
          label="Reconnect Attempts"
          value={streamStatus?.reconnectAttempts ?? 0}
        />
        <KpiCard
          label="Active Sessions"
          value={sessions?.data?.length ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="p-4 rounded-md border border-border bg-card">
          <h3 className="text-sm font-medium mb-4 text-muted-foreground uppercase">
            Provider Status
          </h3>
          {streamStatus?.provider && (
            <div className="mb-4 flex justify-between items-center pb-3 border-b border-border">
              <div>
                <div className="font-medium">{streamStatus.provider}</div>
                <div className="text-xs text-muted-foreground mt-0.5">active provider</div>
              </div>
              <Badge variant={streamStatus.streaming ? "healthy" : "failed"}>
                {streamStatus.streaming ? "streaming" : "offline"}
              </Badge>
            </div>
          )}
          {availableProviders.map((p) => (
            <div key={p.name} className="flex justify-between items-center mb-2 last:mb-0">
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.description}</div>
              </div>
              <Badge variant={p.status === "available" ? "healthy" : "warning"}>
                {p.status}
              </Badge>
            </div>
          ))}
          {availableProviders.length === 0 && !streamStatus?.provider && (
            <div className="text-sm text-muted-foreground">No provider data</div>
          )}
        </div>

        <div className="lg:col-span-2 p-4 rounded-md border border-border bg-card">
          <h3 className="text-sm font-medium mb-4 text-muted-foreground uppercase">
            Market State — BTCUSDT
          </h3>
          {ms ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Last Price</p>
                <p className="text-2xl font-mono">
                  {ms.lastPrice != null ? `$${ms.lastPrice.toLocaleString()}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Spread</p>
                <p className="text-2xl font-mono">
                  {ms.askPrice != null && ms.bidPrice != null
                    ? (ms.askPrice - ms.bidPrice).toFixed(2)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Bid</p>
                <p className="text-xl font-mono text-green-400">
                  {ms.bidPrice != null ? ms.bidPrice.toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Ask</p>
                <p className="text-xl font-mono text-red-400">
                  {ms.askPrice != null ? ms.askPrice.toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">VWAP</p>
                <p className="text-xl font-mono">
                  {ms.vwap != null ? `$${ms.vwap.toLocaleString()}` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge variant={msStatus === "trading" ? "healthy" : "warning"}>
                  {msStatus ?? "unknown"}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Market state unavailable</div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Stream Sessions</h3>
        <DataTable
          data={sessions?.data || []}
          isLoading={isLoadingSessions}
          rowKey={(s) => s.id}
          columns={[
            {
              header: "ID",
              cell: (s) => (
                <span className="font-mono text-xs">{s.id.slice(0, 8)}…</span>
              ),
            },
            { header: "Provider", accessorKey: "provider" },
            {
              header: "Types",
              cell: (s) => (
                <span className="text-xs">{s.streamTypes?.join(", ") ?? "—"}</span>
              ),
            },
            {
              header: "Ticks",
              cell: (s) => parseInt(s.ticksReceived, 10).toLocaleString(),
            },
            { header: "Reconnects", accessorKey: "reconnectCount" },
            {
              header: "Status",
              cell: (s) => (
                <Badge variant={s.status === "active" ? "healthy" : "warning"}>
                  {s.status}
                </Badge>
              ),
            },
            {
              header: "Started",
              cell: (s) => format(new Date(s.startedAt), "MM/dd HH:mm"),
            },
          ]}
        />
      </div>
    </div>
  );
}
