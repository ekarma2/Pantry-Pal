"use client";

import { useState } from "react";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Week = { start: Date; count: number };

const PLOT = 112; // px height of the tallest column; value labels sit above it

const plural = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

/**
 * Single-series column chart: items thrown out per week, oldest to newest.
 * Each column is a focusable hit target with a tooltip; a table view follows.
 */
export function WeeklyWasteChart({ weeks }: { weeks: Week[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const current = weeks.length - 1;

  return (
    <div className="space-y-3">
      <div className="relative">
        {/* Recessive scale: one gridline at the max, plus the baseline. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 flex translate-y-1/2 items-center gap-2"
          style={{ bottom: PLOT + 1 }}
        >
          <span className="text-[11px] tabular-nums text-muted-foreground">{max}</span>
          <span className="h-px flex-1 border-t border-dashed border-border" />
        </div>

        <div role="list" aria-label="Items thrown out per week" className="flex items-end gap-0.5 pl-6" style={{ height: PLOT + 24 }}>
          {weeks.map((w, i) => {
            const label = `Week of ${formatShortDate(w.start)}${i === current ? " (this week)" : ""}: ${plural(w.count)}`;
            return (
              <button
                key={w.start.getTime()}
                type="button"
                role="listitem"
                aria-label={label}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive((a) => (a === i ? null : i))}
                className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(i === current || active === i) && w.count > 0 && (
                  <span className="mb-1 text-xs font-medium tabular-nums">{w.count}</span>
                )}
                <span
                  className={cn(
                    "w-full max-w-7 rounded-t-[4px] bg-waste-bar transition-opacity",
                    active !== null && active !== i && "opacity-50",
                  )}
                  style={{ height: w.count ? Math.max(Math.round((w.count / max) * PLOT), 4) : 0 }}
                />
              </button>
            );
          })}
        </div>
        <div aria-hidden className="ml-6 border-t border-border" />

        {active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
          >
            <span className="text-muted-foreground">Week of {formatShortDate(weeks[active].start)} · </span>
            <span className="font-medium">{plural(weeks[active].count)}</span>
          </div>
        )}
      </div>

      <div aria-hidden className="flex gap-0.5 pl-6 text-[10px] text-muted-foreground">
        {weeks.map((w, i) => (
          <span key={w.start.getTime()} className={cn("flex-1 text-center", i === current && "font-medium text-foreground")}>
            {i === current ? "Now" : w.start.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
          </span>
        ))}
      </div>

      <details className="text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground">Show as table</summary>
        <table className="w-full text-left">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 font-normal">Week of</th>
              <th className="py-1 text-right font-normal">Thrown out</th>
            </tr>
          </thead>
          <tbody>
            {[...weeks].reverse().map((w) => (
              <tr key={w.start.getTime()} className="border-t">
                <td className="py-1">{formatShortDate(w.start)}</td>
                <td className="py-1 text-right tabular-nums">{w.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
