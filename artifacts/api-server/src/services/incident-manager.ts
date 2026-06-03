/**
 * incident-manager.ts — Incident lifecycle management for Phase 12.
 *
 * Creates incidents from critical/emergency alert events.
 * Manages incident status transitions (open → investigating → resolved).
 * Maintains the incident timeline (immutable audit trail).
 */

import { db } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { alertEventsTable } from "@workspace/db/schema";
import {
  insertIncident,
  insertIncidentTimeline,
  updateIncidentStatus,
  getOpenIncidentCount,
  listIncidents,
  getIncidentById,
  insertMonitoringAuditLog,
} from "./ops-db";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Auto-create incident from a critical/emergency alert event
// ---------------------------------------------------------------------------

export async function autoCreateIncidentFromAlert(alertEventId: string, alertTitle: string, alertMessage: string, severity: string, service?: string): Promise<string | null> {
  if (severity !== "critical" && severity !== "emergency") return null;

  try {
    const incident = await insertIncident({
      title: alertTitle,
      description: alertMessage,
      severity,
      status: "open",
      affectedServices: service ? [service] : [],
      triggerSource: "alert_event",
      triggerRef: alertEventId,
    });

    if (!incident) return null;

    await insertIncidentTimeline({
      incidentId: incident.id,
      eventType: "opened",
      message: `Incident auto-created from alert: ${alertTitle}`,
      actor: "system",
      details: { alertEventId, alertMessage, severity },
    });

    await insertMonitoringAuditLog({
      actor: "system",
      action: "incident_opened",
      targetType: "incident",
      targetId: incident.id,
      description: `Auto-opened: ${alertTitle}`,
      details: { severity, service, alertEventId },
    });

    logger.info({ incidentId: incident.id, title: alertTitle }, "Phase 12: Incident auto-created from alert");
    return incident.id;
  } catch (err) {
    logger.warn({ err, alertEventId }, "Failed to auto-create incident");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Resolve an incident
// ---------------------------------------------------------------------------

export async function resolveIncident(id: string, resolution: string, actor = "operator"): Promise<boolean> {
  try {
    const updated = await updateIncidentStatus(id, "resolved", resolution);
    if (!updated) return false;

    await insertIncidentTimeline({
      incidentId: id,
      eventType: "resolved",
      message: `Incident resolved: ${resolution}`,
      actor,
      details: { resolution },
    });

    await insertMonitoringAuditLog({
      actor,
      action: "incident_resolved",
      targetType: "incident",
      targetId: id,
      description: `Resolved: ${resolution}`,
    });

    return true;
  } catch (err) {
    logger.warn({ err, id }, "Failed to resolve incident");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Move to investigating
// ---------------------------------------------------------------------------

export async function investigateIncident(id: string, actor = "operator"): Promise<boolean> {
  try {
    const updated = await updateIncidentStatus(id, "investigating");
    if (!updated) return false;

    await insertIncidentTimeline({
      incidentId: id,
      eventType: "investigating",
      message: "Investigation started",
      actor,
    });

    return true;
  } catch (err) {
    logger.warn({ err, id }, "Failed to move incident to investigating");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Add timeline entry (manual update)
// ---------------------------------------------------------------------------

export async function addIncidentUpdate(id: string, message: string, actor = "operator"): Promise<boolean> {
  try {
    await insertIncidentTimeline({
      incidentId: id,
      eventType: "update",
      message,
      actor,
    });
    return true;
  } catch (err) {
    logger.warn({ err, id }, "Failed to add incident update");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Scan recent critical alerts and auto-open incidents if needed
// ---------------------------------------------------------------------------

export async function scanAndAutoOpenIncidents(): Promise<void> {
  try {
    const since = new Date(Date.now() - 5 * 60 * 1000); // last 5 min
    const criticalAlerts = await db
      .select()
      .from(alertEventsTable)
      .where(
        and(
          eq(alertEventsTable.status, "active"),
          sql`${alertEventsTable.severity} in ('critical','emergency')`,
          sql`${alertEventsTable.firedAt} >= ${since}`,
        ),
      )
      .orderBy(desc(alertEventsTable.firedAt))
      .limit(10);

    for (const alert of criticalAlerts) {
      const openCount = await getOpenIncidentCount();
      if (openCount >= 10) break; // circuit breaker — max 10 open incidents

      // Only auto-create if no recent incident for same rule
      const existing = await listIncidents({ status: "open", limit: 50 });
      const alreadyOpen = existing.some((i) => i.triggerRef === alert.id || (i.title === alert.title && i.status !== "resolved"));
      if (!alreadyOpen) {
        await autoCreateIncidentFromAlert(
          alert.id,
          alert.title,
          alert.message,
          alert.severity,
          alert.service ?? undefined,
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, "Failed to scan and auto-open incidents");
  }
}
