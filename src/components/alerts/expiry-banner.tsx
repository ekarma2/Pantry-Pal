"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Freshness } from "@/lib/freshness";
import type { InventoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SoonRow = { item: InventoryItem; freshness: Freshness };

function names(rows: SoonRow[], max = 3) {
  const shown = rows.slice(0, max).map((r) => r.item.name);
  const more = rows.length - shown.length;
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ");
}

/** Home banner: anything expired or expiring within `warnDays`. Rows are sorted soonest first. */
export function ExpiryBanner({ rows, warnDays, onShow }: { rows: SoonRow[]; warnDays: number; onShow: () => void }) {
  if (rows.length === 0) return null;
  const expired = rows.filter((r) => r.freshness.group === "expired").length;
  const soon = rows.length - expired;
  const window = warnDays === 0 ? "today" : warnDays === 1 ? "by tomorrow" : `within ${warnDays} days`;

  const headline = [
    soon > 0 && `${soon} ${soon === 1 ? "item expires" : "items expire"} ${window}`,
    expired > 0 && `${expired} expired`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      aria-label="Use soon"
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3",
        expired > 0
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
      )}
    >
      <TriangleAlert
        aria-hidden
        className={cn("size-5 shrink-0", expired > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{headline}</p>
        <p className="truncate text-sm text-muted-foreground">{names(rows)}</p>
      </div>
      <Button size="touch" variant="outline" className="shrink-0 bg-background" onClick={onShow}>
        Show
      </Button>
    </section>
  );
}
