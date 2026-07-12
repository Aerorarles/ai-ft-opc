// @ts-check

class MemoryAuditRepository {
  /** @type {Map<string, import("../types.ts").AuditEvent>} */
  events = new Map();
  /** @type {Map<string, string>} */
  idempotencyIndex = new Map();

  /** @param {import("../types.ts").AuditEvent} event */
  async appendAuditEvent(event) {
    const key = `${event.tenant_id}:${event.idempotency_key}`;
    const existingId = this.idempotencyIndex.get(key);
    if (existingId) return { event: this.events.get(existingId), reused: true };
    this.events.set(event.audit_event_id, event);
    this.idempotencyIndex.set(key, event.audit_event_id);
    return { event, reused: false };
  }

  /** @param {string} requestTraceId */
  async getAuditEventsByTrace(requestTraceId) {
    return Array.from(this.events.values())
      .filter((event) => event.request_trace_id === requestTraceId)
      .sort((left, right) => left.sequence_index - right.sequence_index);
  }

  /** @param {string} entityType @param {string} entityId */
  async getAuditEventsByEntity(entityType, entityId) {
    return Array.from(this.events.values())
      .filter((event) => event.entity_type === entityType && event.entity_id === entityId)
      .sort((left, right) => left.sequence_index - right.sequence_index);
  }
}

module.exports = { MemoryAuditRepository };
