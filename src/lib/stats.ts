// Waste stats (spec 4.6): pure math over wasteLog entries and recently added items.

import { addDays, startOfDay } from "@/lib/dates";
import { weekStart } from "@/lib/meals";

export const CHART_WEEKS = 8;
export const RATE_DAYS = 30;

export type WasteEntry = { id: string; itemName: string; category: string; reason: string | null; wastedAt: Date };
export type AddedItem = { status: string; addedAt: Date };

export type WasteStats = {
  thisWeek: number;
  thisMonth: number;
  /** Of items added in the last RATE_DAYS days, how many were thrown out. */
  rate: { wasted: number; added: number; percent: number | null };
  /** Oldest first; the last entry is the current week. */
  weekly: { start: Date; count: number }[];
  /** Most-wasted first, over the chart window. */
  categories: { category: string; count: number }[];
};

/** Earliest date the stats need data from (query lower bound). */
export function statsSince(today: Date): Date {
  const chartStart = addDays(weekStart(today), -(CHART_WEEKS - 1) * 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const rateStart = addDays(startOfDay(today), -(RATE_DAYS - 1));
  return new Date(Math.min(chartStart.getTime(), monthStart.getTime(), rateStart.getTime()));
}

export function computeStats(waste: WasteEntry[], added: AddedItem[], today: Date): WasteStats {
  const week = weekStart(today);
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  const rateStart = addDays(startOfDay(today), -(RATE_DAYS - 1));
  const chartStart = addDays(week, -(CHART_WEEKS - 1) * 7);

  const weekly = Array.from({ length: CHART_WEEKS }, (_, i) => ({ start: addDays(chartStart, i * 7), count: 0 }));
  const byCategory = new Map<string, number>();
  for (const w of waste) {
    if (w.wastedAt < chartStart) continue;
    const i = weekly.findLastIndex((b) => w.wastedAt >= b.start);
    if (i >= 0) weekly[i].count++;
    byCategory.set(w.category, (byCategory.get(w.category) ?? 0) + 1);
  }

  const recent = added.filter((a) => a.addedAt >= rateStart);
  const recentWasted = recent.filter((a) => a.status === "wasted").length;

  return {
    thisWeek: waste.filter((w) => w.wastedAt >= week).length,
    thisMonth: waste.filter((w) => w.wastedAt >= month).length,
    rate: {
      wasted: recentWasted,
      added: recent.length,
      percent: recent.length ? Math.round((recentWasted / recent.length) * 100) : null,
    },
    weekly,
    categories: [...byCategory]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
  };
}
