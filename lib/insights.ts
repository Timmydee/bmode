import { backend, type UsageEventKind } from "@/lib/backend";
import { getDeviceId, isFirstVisitToday } from "@/lib/identity/device-id";

// Usage counting must never get in the way of playing, so every failure
// (blocked storage, network, missing migration) is swallowed.
export function track(event: UsageEventKind, sessionId?: string | null): void {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  backend.insights
    .recordEvent({ deviceId, event, sessionId })
    .catch(() => {});
}

/** Counts this browser once per day, whichever page it lands on. */
export function trackDailyVisit(): void {
  if (getDeviceId() && isFirstVisitToday()) track("visit");
}
