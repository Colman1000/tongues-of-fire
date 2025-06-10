import { db } from "@/db";
import { auditLogs, type auditLogActions } from "@/db/schema";

type AuditEvent = {
  actor: string;
  action: (typeof auditLogActions)[number];
  details?: Record<string, any>;
};

/**
 * Logs an audit event to the database.
 * @param event The audit event to log.
 */
export async function logAuditEvent(event: AuditEvent) {
  try {
    await db.insert(auditLogs).values({
      actor: event.actor,
      action: event.action,
      details: event.details ?? null,
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}
