const DEVICE_ID_KEY = "bmode:device-id";
const LAST_VISIT_KEY = "bmode:last-visit";

// One random id per browser, used only to count distinct people. It is not
// linked to a nickname, email or participant token. Returns null when
// storage is blocked (private mode), in which case nothing is counted.
export function getDeviceId(): string | null {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}

/** True the first time it's called on a given local calendar day. */
export function isFirstVisitToday(now = new Date()): boolean {
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  try {
    if (localStorage.getItem(LAST_VISIT_KEY) === today) return false;
    localStorage.setItem(LAST_VISIT_KEY, today);
    return true;
  } catch {
    return false;
  }
}
