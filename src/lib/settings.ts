/** users/{uid}/settings/main — one doc per user. Shared by the client and the digest cron. */
export const SETTINGS_DOC_ID = "main";

/** The browser's PushSubscription.toJSON() shape. */
export type StoredPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export type Settings = {
  /** Local "HH:MM". The cron runs hourly, so minutes are always "00" in the UI. */
  notifyTime: string;
  /** Alert about items expiring within this many days (also drives the Home banner). */
  warnDaysBefore: number;
  /** IANA zone, kept in sync with the device so the cron knows the user's local time. */
  timezone: string;
  /** The one device that receives the daily digest. */
  pushSubscription: StoredPushSubscription | null;
  /** Local "YYYY-MM-DD" of the last digest the cron handled (server-written). */
  lastDigestDate: string | null;
};

export const DEFAULT_SETTINGS: Settings = {
  notifyTime: "17:00",
  warnDaysBefore: 2,
  timezone: "UTC",
  pushSubscription: null,
  lastDigestDate: null,
};

export const WARN_DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 7] as const;
export const NOTIFY_HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00–22:00

export function settingsFromDoc(d: Record<string, unknown> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!d) return s;
  if (typeof d.notifyTime === "string" && /^\d{2}:\d{2}$/.test(d.notifyTime)) s.notifyTime = d.notifyTime;
  if (typeof d.warnDaysBefore === "number" && d.warnDaysBefore >= 0 && d.warnDaysBefore <= 14) {
    s.warnDaysBefore = Math.round(d.warnDaysBefore);
  }
  if (typeof d.timezone === "string" && d.timezone) s.timezone = d.timezone;
  if (isPushSubscription(d.pushSubscription)) s.pushSubscription = d.pushSubscription;
  if (typeof d.lastDigestDate === "string") s.lastDigestDate = d.lastDigestDate;
  return s;
}

// Browser push services. The server only ever POSTs to these, so a crafted
// endpoint in a user's own settings doc can't point the cron at anything else.
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
];

export function isPushSubscription(v: unknown): v is StoredPushSubscription {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<StoredPushSubscription>;
  if (typeof s.endpoint !== "string" || typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") {
    return false;
  }
  try {
    const url = new URL(s.endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function formatHour(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
