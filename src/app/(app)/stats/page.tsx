"use client";

import { useEffect, useMemo, useState } from "react";
import { PartyPopper } from "lucide-react";
import { useAddSheet } from "@/components/add/add-sheet";
import { useAuth } from "@/components/auth-provider";
import { WeeklyWasteChart } from "@/components/stats/weekly-waste-chart";
import { Button } from "@/components/ui/button";
import { useToday } from "@/hooks/use-today";
import { formatShortDate } from "@/lib/dates";
import { computeStats, RATE_DAYS, statsSince, type AddedItem, type WasteEntry } from "@/lib/stats";
import { subscribeAddedSince, subscribeWaste } from "@/lib/stats-client";
import { WASTE_REASONS } from "@/lib/types";

const REASON_LABEL: Record<string, string> = Object.fromEntries(WASTE_REASONS.map((r) => [r.value, r.label]));

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export default function StatsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const today = useToday();
  const { openAdd } = useAddSheet();
  const since = useMemo(() => statsSince(today), [today]);
  const [waste, setWaste] = useState<WasteEntry[] | null>(null);
  const [added, setAdded] = useState<AddedItem[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeWaste(uid, since, setWaste);
  }, [uid, since]);

  useEffect(() => {
    if (!uid) return;
    return subscribeAddedSince(uid, since, setAdded);
  }, [uid, since]);

  const stats = useMemo(() => (waste && added ? computeStats(waste, added, today) : null), [waste, added, today]);

  if (!stats || !waste) {
    return (
      <div aria-busy="true" aria-label="Loading stats" className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (waste.length === 0 && stats.rate.added === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-lg font-medium">No stats yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Add groceries and mark what you use or throw out. Your waste trends show up here.
        </p>
        <Button size="touch" onClick={openAdd}>
          Add groceries
        </Button>
      </div>
    );
  }

  const maxCategory = stats.categories[0]?.count ?? 1;
  const { rate } = stats;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="This week" value={String(stats.thisWeek)} note="thrown out" />
        <Tile label="This month" value={String(stats.thisMonth)} note="thrown out" />
        <Tile
          label="Waste rate"
          value={rate.percent == null ? "–" : `${rate.percent}%`}
          note={rate.added ? `${rate.wasted} of ${rate.added} added` : "nothing added"}
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Waste rate: items added in the last {RATE_DAYS} days that ended up thrown out.
      </p>

      {waste.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <PartyPopper aria-hidden className="size-6 shrink-0 text-primary" />
          <p className="text-sm">Nothing thrown out in the last 8 weeks. Nice work!</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="weekly-heading" className="space-y-3 rounded-xl border bg-card p-4">
            <h2 id="weekly-heading" className="font-semibold">
              Thrown out per week
            </h2>
            <WeeklyWasteChart weeks={stats.weekly} />
          </section>

          <section aria-labelledby="cat-heading" className="space-y-3 rounded-xl border bg-card p-4">
            <h2 id="cat-heading" className="font-semibold">
              Most wasted <span className="text-sm font-normal text-muted-foreground">· last 8 weeks</span>
            </h2>
            <ul className="space-y-2">
              {stats.categories.slice(0, 5).map((c) => (
                <li key={c.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{c.category}</span>
                    <span className="tabular-nums text-muted-foreground">{c.count}</span>
                  </div>
                  <div aria-hidden className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-waste-bar"
                      style={{ width: `${Math.max((c.count / maxCategory) * 100, 4)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="recent-heading" className="space-y-2">
            <h2 id="recent-heading" className="text-sm font-semibold">
              Recently thrown out
            </h2>
            <ul className="divide-y rounded-xl border bg-card">
              {waste.slice(0, 8).map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{w.itemName}</span>
                    <span className="text-xs text-muted-foreground">
                      {w.reason ? REASON_LABEL[w.reason] ?? w.reason : "No reason given"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatShortDate(w.wastedAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
