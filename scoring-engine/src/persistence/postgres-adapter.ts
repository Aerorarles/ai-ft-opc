// @ts-check

/**
 * PostgreSQL EventStore adapter stub.
 *
 * This class intentionally contains no database connection code, no SQL, and
 * no credential handling. It exists only to define the future adapter surface.
 */
class PostgresEventStoreAdapter {
  /** @type {unknown} */
  options;

  /**
   * @param {unknown=} options
   */
  constructor(options) {
    this.options = options || {};
  }

  /**
   * @param {string} execution_id
   * @param {import("../execution-events.ts").ScoringExecutionEvent} event
   */
  appendEvent(execution_id, event) {
    throw new Error("PostgresEventStoreAdapter.appendEvent is a stub and does not execute SQL.");
  }

  /**
   * @param {string} execution_id
   */
  getEvents(execution_id) {
    throw new Error("PostgresEventStoreAdapter.getEvents is a stub and does not execute SQL.");
  }

  /**
   * @param {string} execution_id
   */
  getExecutionSnapshot(execution_id) {
    throw new Error("PostgresEventStoreAdapter.getExecutionSnapshot is a stub and does not execute SQL.");
  }

  /**
   * @param {string} execution_id
   * @param {import("./event-store.interface.ts").ExecutionSnapshot} snapshot
   */
  saveSnapshot(execution_id, snapshot) {
    throw new Error("PostgresEventStoreAdapter.saveSnapshot is a stub and does not execute SQL.");
  }

  /**
   * @param {string} execution_id
   * @param {import("./event-store.interface.ts").ReplayConsistencyResult} result
   */
  markReplayConsistency(execution_id, result) {
    throw new Error("PostgresEventStoreAdapter.markReplayConsistency is a stub and does not execute SQL.");
  }
}

module.exports = {
  PostgresEventStoreAdapter,
};
