import { daysUntil } from "@/lib/dates";
import type { InventoryItem } from "@/lib/types";

export type FreshnessGroup = "expired" | "today" | "week" | "later";

export const GROUPS: { key: FreshnessGroup; label: string }[] = [
  { key: "expired", label: "Expired" },
  { key: "today", label: "Use today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
];

export type Tone = "red" | "amber" | "green" | "neutral";

export type Freshness = {
  group: FreshnessGroup;
  days: number | null;
  label: string;
  tone: Tone;
};

export function freshnessOf(expiresAt: Date | null, today: Date): Freshness {
  if (!expiresAt) return { group: "later", days: null, label: "No date", tone: "neutral" };
  const days = daysUntil(expiresAt, today);
  if (days < 0) {
    const label = days === -1 ? "Expired yesterday" : `Expired ${-days} days ago`;
    return { group: "expired", days, label, tone: "red" };
  }
  if (days === 0) return { group: "today", days, label: "Expires today", tone: "red" };
  if (days === 1) return { group: "week", days, label: "Expires tomorrow", tone: "amber" };
  if (days <= 7) return { group: "week", days, label: `${days} days left`, tone: "amber" };
  return { group: "later", days, label: `${days} days left`, tone: "green" };
}

/** Soonest expiry first; undated items last; then by name. */
export function compareByExpiry(a: InventoryItem, b: InventoryItem): number {
  const ta = a.expiresAt?.getTime() ?? Infinity;
  const tb = b.expiresAt?.getTime() ?? Infinity;
  if (ta !== tb) return ta - tb;
  return a.name.localeCompare(b.name);
}
