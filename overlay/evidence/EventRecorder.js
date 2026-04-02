const { createId, nowIso } = require("../utils/validation");

class EventRecorder {
  constructor() {
    this.events = [];
  }

  record(type, payload = {}) {
    const event = {
      eventId: createId("event"),
      type,
      payload,
      recordedAt: nowIso(),
    };
    this.events.push(event);
    return event;
  }

  list() {
    return [...this.events];
  }

  clear() {
    this.events = [];
  }
}

module.exports = EventRecorder;
