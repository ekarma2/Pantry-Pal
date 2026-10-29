// Daily "use it up" digest: pure logic, run by the cron in the user's time zone.

import type { Settings } from "@/lib/settings";

export type DigestItem = { name: string; expiresAt: Date };
export type DigestMessage = { title: string; body: string; url: string };

/** Wall-clock date ("YYYY-MM-DD") and hour of `at` in `timeZone`. */
export function localParts(at: Date, timeZone: string): { date: string; hour: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
  } catch {
    return localParts(at, "UTC"); // unknown zone
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** "YYYY-MM-DD" + n calendar days. */
export function addDaysToDate(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Should the cron send this user's digest now? True once per local day, at or after notifyTime. */
export function isDigestDue(settings: Settings, now: Date): boolean {
  if (!settings.pushSubscription) return false;
  const { date, hour } = localParts(now, settings.timezone);
  const notifyHour = Number(settings.notifyTime.slice(0, 2));
  return hour >= notifyHour && settings.lastDigestDate !== date;
}

function listNames(items: DigestItem[], max = 3): string {
  const names = items.slice(0, max).map((i) => i.name);
  const more = items.length - names.length;
  return more > 0 ? `${names.join(", ")} and ${more} more` : names.join(", ");
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * "3 items expire in the next 2 days: spinach, chicken breast, yogurt."
 * Returns null when nothing is expired or due within `warnDays`.
 */
export function buildDigest(items: DigestItem[], now: Date, settings: Pick<Settings, "timezone" | "warnDaysBefore">) {
  const today = localParts(now, settings.timezone).date;
  const last = addDaysToDate(today, settings.warnDaysBefore);
  const dated = items
    .map((i) => ({ ...i, day: localParts(i.expiresAt, settings.timezone).date }))
    .filter((i) => i.day <= last)
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());

  const expired = dated.filter((i) => i.day < today);
  const soon = dated.filter((i) => i.day >= today);
  if (dated.length === 0) return null;

  const window =
    settings.warnDaysBefore === 0
      ? "today"
      : settings.warnDaysBefore === 1
        ? "by tomorrow"
        : `in the next ${settings.warnDaysBefore} days`;

  const sentences: string[] = [];
  if (soon.length) {
    sentences.push(
      `${soon.length} ${plural(soon.length, "item expires", "items expire")} ${window}: ${listNames(soon)}.`,
    );
  }
  if (expired.length) {
    sentences.push(
      soon.length
        ? `${expired.length} already expired.`
        : `${expired.length} ${plural(expired.length, "item has", "items have")} expired: ${listNames(expired)}.`,
    );
  }

  return { title: "Use it up", body: sentences.join(" "), url: "/?view=soon" } satisfies DigestMessage;
}
