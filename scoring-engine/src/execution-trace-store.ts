// @ts-check

/** @type {Map<string, import("./execution-events.ts").ScoringExecutionEvent[]>} */
const eventStore = new Map();

/**
 * @param {string} executionId
 */
function clearExecutionTrace(executionId) {
  eventStore.set(executionId, []);
}

/**
 * @param {string} executionId
 * @param {import("./execution-events.ts").ScoringExecutionEvent} event
 * @returns {import("./execution-events.ts").ScoringExecutionEvent}
 */
function appendEvent(executionId, event) {
  if (!eventStore.has(executionId)) {
    eventStore.set(executionId, []);
  }
  const events = eventStore.get(executionId);
  const eventWithSequence = {
    ...event,
    sequence_index: typeof event.sequence_index === "number" ? event.sequence_index : events.length,
  };
  events.push(eventWithSequence);
  return eventWithSequence;
}

/**
 * @param {string} executionId
 * @returns {import("./execution-events.ts").ScoringExecutionEvent[]}
 */
function getEvents(executionId) {
  return [...(eventStore.get(executionId) || [])].sort((left, right) => {
    const leftSequence = typeof left.sequence_index === "number" ? left.sequence_index : 0;
    const rightSequence = typeof right.sequence_index === "number" ? right.sequence_index : 0;
    if (leftSequence !== rightSequence) {
      return leftSequence - rightSequence;
    }
    return String(left.timestamp).localeCompare(String(right.timestamp));
  });
}

/**
 * @param {string} executionId
 * @returns {{ execution_id: string, event_count: number, events: import("./execution-events.ts").ScoringExecutionEvent[] }}
 */
function getExecutionTrace(executionId) {
  const events = getEvents(executionId);
  return {
    execution_id: executionId,
    event_count: events.length,
    events,
  };
}

module.exports = {
  appendEvent,
  clearExecutionTrace,
  getEvents,
  getExecutionTrace,
};
