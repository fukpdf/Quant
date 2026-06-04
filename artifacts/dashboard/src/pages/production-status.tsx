import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { HealthBar } from "@/components/ui/health-bar";
import {
  Shield,
  Database,
  Activity,
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Server,
  Zap,
  Archive,
} from "lucide-react";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`/api/v1${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`/api/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthDep {
  status: "healthy" | "degraded" | "unavailable";
  latencyMs?: number;
  detail?: string;
}

interface HealthDependencies {
  status: string;
  uptime: number;
  checkDurationMs: number;
  nodeVersion: string;
  environment: string;
  dependencies: Record<string, HealthDep>;
}

interface BackupRun {
  id: string;
  status: string;
  backupType: string;
  tableCount: number | null;
  rowCount: number | null;
  isValidated: boolean;
  completedAt: string | null;
  durationMs: number | null;
}

interface BackupJob {
  id: string;
  name: string;
  backupType: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

interface BackupOverview {
  jobs: BackupJob[];
  latestSuccessfulBackup: BackupRun | null;
}

interface RestoreTest {
  id: string;
  status: string;
  testType: string;
  passed: boolean | null;
  durationMs: number | null;
  resultSummary: string | null;
  createdAt: string;
}

interface SecurityCheck {
  id: string;
  category: string;
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  detail: string;
  severity: string;
}

interface SecurityAudit {
  timestamp: string;
  environment: string;
  overallScore: number;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  summary: string;
  checks: SecurityCheck[];
}

interface NotificationChannel {
  id: string;
  name: string;
  channelType: string;
  isActive: boolean;
  successCount: number;
  failureCount: number;
  lastSuccessAt: string | null;
}

interface NotificationOverview {
  channels: NotificationChannel[];
  deliveryStats24h: { total: number; delivered: number; failed: number; successRate: number };
}

interface ProfilingSnapshot {
  timestamp: string;
  memory: { heapUsedMb: number; heapTotalMb: number; heapUtilizationPct: number };
  apiLatency: { p50Ms: number; p95Ms: number; p99Ms: number; sampleCount: number };
  dbLatency: { p50Ms: number; p95Ms: number; sampleCount: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function depVariant(status: string): "healthy" | "degraded" | "failed" {
  if (status === "healthy" || status === "ok" || status === "ready") return "healthy";
  if (status === "degraded" || status === "warn") return "degraded";
  return "failed";
}

function DepDot({ status }: { status: string }) {
  if (status === "healthy") return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />;
  if (status === "degraded") return <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
}

// ---------------------------------------------------------------------------
// Tabs state
// ---------------------------------------------------------------------------

const TABS = ["overview", "security", "backups", "performance", "notifications"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  security: "Security Checks",
  backups: "Backup & Recovery",
  performance: "Performance",
  notifications: "Notifications",
};

// ---------------------------------------------------------------------------
// Health Section
// ---------------------------------------------------------------------------

function HealthSection() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["health-dependencies"],
    queryFn: () =>
      fetch("/api/health/dependencies").then((r) => r.json()) as Promise<HealthDependencies>,
    refetchInterval: 30_000,
  });

  const liveness = useQuery({
    queryKey: ["health-live"],
    queryFn: () =>
      fetch("/api/health/live").then((r) => r.json()) as Promise<{ status: string; uptime: number }>,
    refetchInterval: 15_000,
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Server className="h-4 w-4" />
          Server Health
        </div>
        <div className="flex items-center gap-2">
          {liveness.data && (
            <Badge variant="healthy">Uptime: {fmtUptime(liveness.data.uptime)}</Badge>
          )}
          <button
            onClick={() => void refetch()}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Checking dependencies…</p>
      ) : data ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall</span>
            <Badge variant={depVariant(data.status)}>{data.status}</Badge>
          </div>
          <div className="border-t border-border" />
          {Object.entries(data.dependencies).map(([name, dep]) => (
            <div key={name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <DepDot status={dep.status} />
                <span className="capitalize">{name.replace(/([A-Z])/g, " $1").trim()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground text-right">
                {dep.latencyMs != null && <span>{dep.latencyMs}ms</span>}
                <span className="max-w-[180px] truncate" title={dep.detail}>
                  {dep.detail}
                </span>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            Node {data.nodeVersion} · {data.environment} · check {data.checkDurationMs}ms
          </p>
        </div>
      ) : (
        <p className="text-sm text-red-500">Failed to load dependency health</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security Audit Section
// ---------------------------------------------------------------------------

function SecurityAuditSection() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["security-audit"],
    queryFn: () => apiFetch<SecurityAudit>("/ops/security-audit"),
    refetchInterval: 5 * 60_000,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiPost("/ops/security-audit/refresh");
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const scoreColor =
    !data
      ? "text-muted-foreground"
      : data.overallScore >= 90
      ? "text-green-500"
      : data.overallScore >= 75
      ? "text-yellow-500"
      : "text-red-500";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Shield className="h-4 w-4" />
          Security Audit
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Running audit…</p>
      ) : data ? (
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-bold ${scoreColor}`}>{data.overallScore}</span>
            <span className="text-muted-foreground text-sm mb-1">/ 100</span>
          </div>
          <HealthBar value={data.overallScore} showValue />
          <p className="text-xs text-muted-foreground">{data.summary}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-semibold text-green-500">{data.passed}</div>
              <div className="text-xs text-muted-foreground">Passed</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-yellow-500">{data.warnings}</div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-red-500">{data.failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data.checks
              .filter((c) => c.status !== "pass")
              .map((check) => (
                <div
                  key={check.id}
                  className="flex items-start gap-2 text-xs p-1.5 rounded bg-muted/50"
                >
                  {check.status === "warn" ? (
                    <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <div className="font-medium">{check.name}</div>
                    <div className="text-muted-foreground">{check.detail}</div>
                  </div>
                </div>
              ))}
            {data.failed === 0 && data.warnings === 0 && (
              <div className="flex items-center gap-2 text-xs text-green-500 p-1">
                <CheckCircle2 className="h-3 w-3" />
                All checks passed
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Last checked: {fmtDate(data.timestamp)}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Security audit unavailable (requires auth)</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backup Section
// ---------------------------------------------------------------------------

function BackupSection() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["backup-overview"],
    queryFn: () => apiFetch<BackupOverview>("/ops/backups"),
    refetchInterval: 60_000,
  });

  const { data: recoveryData } = useQuery({
    queryKey: ["recovery-overview"],
    queryFn: () =>
      apiFetch<{ tests: RestoreTest[]; latestTest: RestoreTest | null }>("/ops/recovery"),
    refetchInterval: 60_000,
  });

  const latest = data?.latestSuccessfulBackup;
  const latestTest = recoveryData?.latestTest;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Archive className="h-4 w-4" />
          Backup & Recovery
        </div>
        <button
          onClick={() => void refetch()}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading backup status…</p>
      ) : (
        <div className="space-y-3">
          {/* Latest backup */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Latest Backup
            </p>
            {latest ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Status</span>
                  <Badge variant={latest.status === "completed" ? "healthy" : "failed"}>
                    {latest.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Type</span>
                  <span className="text-muted-foreground">{latest.backupType}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Tables</span>
                  <span className="text-muted-foreground">{latest.tableCount ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Validated</span>
                  {latest.isValidated ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Completed: {fmtDate(latest.completedAt)}
                  {latest.durationMs != null && ` · ${latest.durationMs}ms`}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No successful backups yet</p>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Restore test */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Latest Restore Test
            </p>
            {latestTest ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Result</span>
                  <div className="flex items-center gap-1">
                    {latestTest.passed === true ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : latestTest.passed === false ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : null}
                    <Badge
                      variant={
                        latestTest.status === "completed" && latestTest.passed
                          ? "healthy"
                          : latestTest.status === "failed"
                          ? "failed"
                          : "degraded"
                      }
                    >
                      {latestTest.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Type</span>
                  <span className="text-muted-foreground">{latestTest.testType}</span>
                </div>
                {latestTest.resultSummary && (
                  <p className="text-xs text-muted-foreground">{latestTest.resultSummary}</p>
                )}
                <p className="text-xs text-muted-foreground">Run: {fmtDate(latestTest.createdAt)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No restore tests yet</p>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Backup jobs */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Scheduled Jobs
            </p>
            <div className="space-y-1">
              {data?.jobs.length ? (
                data.jobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      {job.isActive ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                      )}
                      {job.name}
                    </span>
                    <span className="text-muted-foreground">{job.backupType}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No backup jobs configured</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Performance Section
// ---------------------------------------------------------------------------

function PerformanceSection() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profiling-snapshot"],
    queryFn: () => apiFetch<ProfilingSnapshot>("/ops/profiling"),
    refetchInterval: 30_000,
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Zap className="h-4 w-4" />
          Performance
        </div>
        <button
          onClick={() => void refetch()}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading metrics…</p>
      ) : data ? (
        <div className="space-y-3">
          {/* Memory */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Heap Memory</span>
              <span>
                {data.memory.heapUsedMb}MB / {data.memory.heapTotalMb}MB
              </span>
            </div>
            <HealthBar value={100 - data.memory.heapUtilizationPct} showValue />
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.memory.heapUtilizationPct}% utilized
            </p>
          </div>

          <div className="border-t border-border" />

          {/* API Latency */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              API Latency (5-min window)
            </p>
            {data.apiLatency.sampleCount > 0 ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold">{data.apiLatency.p50Ms}ms</div>
                  <div className="text-xs text-muted-foreground">p50</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{data.apiLatency.p95Ms}ms</div>
                  <div className="text-xs text-muted-foreground">p95</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{data.apiLatency.p99Ms}ms</div>
                  <div className="text-xs text-muted-foreground">p99</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No API samples yet — make some requests first
              </p>
            )}
            {data.apiLatency.sampleCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {data.apiLatency.sampleCount} samples
              </p>
            )}
          </div>

          <div className="border-t border-border" />

          {/* DB Latency */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              DB Latency
            </p>
            {data.dbLatency.sampleCount > 0 ? (
              <div className="flex gap-4 text-sm">
                <span>
                  p50: <strong>{data.dbLatency.p50Ms}ms</strong>
                </span>
                <span>
                  p95: <strong>{data.dbLatency.p95Ms}ms</strong>
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No DB samples yet</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">Snapshot: {fmtDate(data.timestamp)}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Performance data unavailable (requires auth)
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications Section
// ---------------------------------------------------------------------------

function NotificationsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["notification-overview"],
    queryFn: () => apiFetch<NotificationOverview>("/ops/notification-channels"),
    refetchInterval: 60_000,
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Bell className="h-4 w-4" />
        Alert Delivery
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading channels…</p>
      ) : data ? (
        <div className="space-y-3">
          {/* 24h stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-semibold">{data.deliveryStats24h.total}</div>
              <div className="text-xs text-muted-foreground">24h Total</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-500">
                {data.deliveryStats24h.delivered}
              </div>
              <div className="text-xs text-muted-foreground">Delivered</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{data.deliveryStats24h.successRate}%</div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Channels */}
          <div className="space-y-2">
            {data.channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notification channels configured</p>
            ) : (
              data.channels.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {ch.isActive ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <div>
                      <div>{ch.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{ch.channelType}</div>
                    </div>
                  </div>
                  <div className="text-xs text-right text-muted-foreground">
                    <div>
                      {ch.successCount} ok / {ch.failureCount} fail
                    </div>
                    {ch.lastSuccessAt && (
                      <div>Last: {new Date(ch.lastSuccessAt).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Alert delivery unavailable (requires auth)</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security Checks Detail Tab
// ---------------------------------------------------------------------------

function SecurityChecksDetail() {
  const { data } = useQuery({
    queryKey: ["security-audit"],
    queryFn: () => apiFetch<SecurityAudit>("/ops/security-audit"),
  });

  if (!data) {
    return <p className="text-sm text-muted-foreground p-4">Security audit not loaded</p>;
  }

  const grouped = data.checks.reduce<Record<string, SecurityCheck[]>>((acc, check) => {
    acc[check.category] = [...(acc[check.category] ?? []), check];
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, checks]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold mb-2">{category}</h3>
          <div className="space-y-1">
            {checks.map((check) => (
              <div
                key={check.id}
                className="flex items-start gap-3 text-sm p-2 rounded border border-border"
              >
                {check.status === "pass" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                ) : check.status === "warn" ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                ) : check.status === "skip" ? (
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{check.name}</span>
                    <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5 capitalize">
                      {check.severity}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{check.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProductionStatusPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const securityAudit = useQuery({
    queryKey: ["security-audit"],
    queryFn: () => apiFetch<SecurityAudit>("/ops/security-audit"),
    refetchInterval: 5 * 60_000,
  });

  const liveness = useQuery({
    queryKey: ["health-live"],
    queryFn: () =>
      fetch("/api/health/live").then((r) => r.json()) as Promise<{ status: string; uptime: number }>,
    refetchInterval: 15_000,
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Production Status</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Security posture, backup health, performance, and dependency status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-500" />
          <span className="text-xs text-muted-foreground">Live monitoring</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Server Status"
          value={
            liveness.data?.status === "alive" ? (
              <span className="text-green-500">Live</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
        />
        <KpiCard
          label="Security Score"
          value={securityAudit.data ? `${securityAudit.data.overallScore}/100` : "—"}
          trend={
            securityAudit.data?.overallScore != null
              ? securityAudit.data.overallScore >= 90
                ? "up"
                : "down"
              : undefined
          }
        />
        <KpiCard
          label="Controls Passing"
          value={
            securityAudit.data
              ? `${securityAudit.data.passed}/${securityAudit.data.totalChecks}`
              : "—"
          }
        />
        <KpiCard
          label="Uptime"
          value={liveness.data ? fmtUptime(liveness.data.uptime) : "—"}
        />
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HealthSection />
          <SecurityAuditSection />
          <BackupSection />
          <PerformanceSection />
        </div>
      )}

      {activeTab === "security" && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-4">
            <Shield className="h-4 w-4" />
            Security Control Details
          </div>
          <SecurityChecksDetail />
        </div>
      )}

      {activeTab === "backups" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BackupSection />
          <NotificationsSection />
        </div>
      )}

      {activeTab === "performance" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PerformanceSection />
          <HealthSection />
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <NotificationsSection />
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4" />
              Alert Delivery Architecture
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>The notification engine fans out alerts to all active channels that match the alert severity.</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2"><span className="w-20 font-medium">Severity</span><span>warning → critical → emergency (escalating)</span></div>
                <div className="flex items-center gap-2"><span className="w-20 font-medium">Retries</span><span>Up to 3 attempts per channel (configurable)</span></div>
                <div className="flex items-center gap-2"><span className="w-20 font-medium">Cooldown</span><span>5 min between duplicate alerts per channel</span></div>
                <div className="flex items-center gap-2"><span className="w-20 font-medium">Types</span><span>HTTP webhook, Slack Block Kit, email (SMTP)</span></div>
              </div>
              <p className="text-xs">
                All delivery attempts are logged to <code className="bg-muted px-1 rounded">notification_deliveries</code> for audit and success-rate tracking.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
