export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Whole calendar days from `today` to `date` (negative = in the past). */
export function daysUntil(date: Date, today: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000);
}

/** Date -> "YYYY-MM-DD" in local time, for <input type="date">. */
export function toInputDate(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" -> local midnight Date. */
export function fromInputDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
