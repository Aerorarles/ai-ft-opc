class EventEmitter {
  /** @type {Array<Record<string, unknown>>} */
  events;

  /** @type {number} */
  sequenceIndex;

  constructor() {
    this.events = [];
    this.sequenceIndex = 0;
  }

  /**
   * @param {Record<string, unknown>} event
   */
  emit(event) {
    const eventWithSequence = {
      sequence_index: this.sequenceIndex,
      ...event,
    };
    this.sequenceIndex += 1;
    this.events.push(eventWithSequence);
    console.log("📡 EVENT:", eventWithSequence.type);
  }

  /**
   * @returns {Array<Record<string, unknown>>}
   */
  getEvents() {
    return this.events;
  }

  /**
   * @param {string} executionId
   * @returns {Array<Record<string, unknown>>}
   */
  getEventsByExecutionId(executionId) {
    return this.events.filter((event) => event.execution_id === executionId);
  }
}

module.exports = {
  EventEmitter,
};
