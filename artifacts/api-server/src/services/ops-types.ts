/**
 * ops-types.ts — Shared TypeScript types for Phase 12 Observability & Operations Platform.
 */

export type ServiceStatus = "running" | "degraded" | "failed" | "maintenance";
export type AlertSeverity = "warning" | "critical" | "emergency";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type IncidentStatus = "open" | "investigating" | "resolved";
export type UptimeStatus = "up" | "down" | "degraded" | "maintenance";
export type SchedulerStatus = "ok" | "missed" | "failed" | "running";

export type ServiceName =
  | "ingestion"
  | "paper_trading"
  | "risk_engine"
  | "analytics"
  | "streaming"
  | "execution"
  | "intelligence"
  | "ai_research"
  | "data_quality"
  | "market_registry"
  | "platform";

export interface OpsOverview {
  platformScore: number;
  services: ServiceSummary[];
  schedulers: SchedulerSummary[];
  activeAlerts: number;
  openIncidents: number;
  systemMetrics: SystemSummary | null;
  computedAt: string;
}

export interface ServiceSummary {
  service: ServiceName | string;
  status: ServiceStatus;
  healthScore: number;
  message?: string;
  consecutiveFailures: number;
  lastSuccessAt?: string | null;
  checkedAt: string;
}

export interface SchedulerSummary {
  schedulerName: string;
  phase: string | null;
  status: SchedulerStatus;
  lastRunAt: string | null;
  nextRunAt: string | null;
  intervalMs: string | null;
  lastRuntimeMs: string | null;
  missedCount: string;
  failureCount: string;
  successCount: string;
  isActive: boolean;
}

export interface SystemSummary {
  cpuPercent: string | null;
  memoryRssMb: string | null;
  heapUsedMb: string | null;
  eventLoopLagMs: string | null;
  dbLatencyMs: string | null;
  apiAvgLatencyMs: string | null;
  uptimeSeconds: string | null;
  capturedAt: string;
}

export interface AlertRuleDefinition {
  name: string;
  displayName: string;
  category: string;
  severity: AlertSeverity;
  condition: string;
  threshold: string | null;
  cooldownMinutes: number;
  description: string;
}

export interface MetricsCollected {
  cpuPercent: number;
  memoryRssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
  eventLoopLagMs: number;
  uptimeSeconds: number;
}
