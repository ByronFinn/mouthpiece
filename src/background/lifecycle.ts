const HEARTBEAT_ALARM = "mouthpiece-heartbeat";

/**
 * Tracks the in-flight generate AbortController so a new "换一批" request or a
 * settings change (disable / clear key) can abort the previous fetch.
 */
let current: AbortController | null = null;

/** Start a new request context. Aborts any previously in-flight request first. */
export function startRequest(): AbortController {
  abortCurrent();
  const controller = new AbortController();
  current = controller;
  startHeartbeat();
  return controller;
}

/** Abort and forget the current request (no-op if none). Stops the heartbeat. */
export function abortCurrent(): void {
  if (current) {
    current.abort();
    current = null;
  }
  stopHeartbeat();
}

/** Mark the current request as completed (called after a response settles). */
export function completeRequest(): void {
  current = null;
  stopHeartbeat();
}

/**
 * Keep the SW alive during long generate calls by scheduling a no-op alarm
 * roughly every 25s (MV3 SWs are evicted after 30s of inactivity).
 */
function startHeartbeat(): void {
  void chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.42 });
}

function stopHeartbeat(): void {
  void chrome.alarms.clear(HEARTBEAT_ALARM);
}
