const utteranceQueues = new Map();

export function enqueueTutorUtterance(sessionId, payload) {
  const existing = utteranceQueues.get(sessionId) ?? [];
  existing.push({ ...payload, queuedAt: new Date().toISOString() });
  utteranceQueues.set(sessionId, existing);
}

export function getQueuedTutorUtterances(sessionId) {
  return utteranceQueues.get(sessionId) ?? [];
}

export function clearQueuedTutorUtterances(sessionId) {
  utteranceQueues.delete(sessionId);
}
