"use client";

import { apiFetch } from "@/lib/api";
import { addDays, startOfDay } from "@/lib/dates";
import { tableShelfLifeDays } from "@/lib/shelfLife";
import type { Location, NewItem } from "@/lib/types";

type Describable = { name: string; category: string; location: Location };

/** Expiry from the bundled table, counted from `from` (purchase date). */
export function tableExpiry(item: Describable, from: Date): Date | null {
  const days = tableShelfLifeDays(item.name, item.category, item.location);
  return days == null ? null : addDays(startOfDay(from), days);
}

/** Fill in an expiry from the table when the user gave none. */
export function withTableExpiry<T extends NewItem>(item: T, from: Date): T {
  if (item.expiresAt) return item;
  const expiresAt = tableExpiry(item, from);
  return expiresAt ? { ...item, expiresAt, expirySource: "table" } : { ...item, expirySource: null };
}

/** Claude's estimate in days, or null if offline / failed. */
export async function aiShelfLifeDays(item: Describable): Promise<number | null> {
  try {
    const res = await apiFetch("/api/estimate-expiry", {
      method: "POST",
      body: JSON.stringify({ name: item.name, category: item.category, location: item.location }),
    });
    if (!res.ok) return null;
    const { days } = (await res.json()) as { days: number };
    return typeof days === "number" ? days : null;
  } catch {
    return null;
  }
}
