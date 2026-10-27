"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddSheet } from "@/components/add/add-sheet";
import { useInventory } from "@/components/inventory/inventory-provider";
import { ItemDetailSheet } from "@/components/inventory/item-detail-sheet";
import { ItemRow } from "@/components/inventory/item-row";
import { LOCATION_LABEL } from "@/components/inventory/location-icon";
import { useItemActions } from "@/components/inventory/use-item-actions";
import { useToday } from "@/hooks/use-today";
import { compareByExpiry, freshnessOf, GROUPS } from "@/lib/freshness";
import { LOCATIONS, type Location } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | Location;

export default function PantryPage() {
  const { items, loading } = useInventory();
  const { openAdd } = useAddSheet();
  const actions = useItemActions();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = items
      .filter((i) => filter === "all" || i.location === filter)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      .sort(compareByExpiry)
      .map((item) => ({ item, freshness: freshnessOf(item.expiresAt, today) }));
    return GROUPS.map((g) => ({ ...g, rows: visible.filter((r) => r.freshness.group === g.key) })).filter(
      (g) => g.rows.length > 0,
    );
  }, [items, filter, search, today]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const filtered = filter !== "all" || search.trim() !== "";

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search inventory"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pl-9 text-base"
        />
      </div>

      <div role="group" aria-label="Filter by location" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {(["all", ...LOCATIONS] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "h-11 shrink-0 rounded-full border px-4 text-sm",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-background",
            )}
          >
            {f === "all" ? "All" : LOCATION_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <ul aria-busy="true" aria-label="Loading inventory" className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-lg font-medium">Your pantry is empty</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Add what you bought and we&apos;ll tell you what to eat first.
          </p>
          <Button size="touch" onClick={openAdd}>Add your first items</Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="font-medium">No matches</p>
          {filtered && (
            <Button
              variant="outline"
              size="touch"
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
            >
              <X /> Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`group-${g.key}`} className="space-y-2">
              <h2 id={`group-${g.key}`} className="flex items-baseline gap-2 text-sm font-semibold">
                {g.label}
                <span className="font-normal text-muted-foreground">{g.rows.length}</span>
              </h2>
              <ul className="space-y-2">
                {g.rows.map(({ item, freshness }) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    freshness={freshness}
                    onOpen={() => setSelectedId(item.id)}
                    onSwipeRight={() => actions.used(item)}
                    onSwipeLeft={() => actions.wasted(item)}
                  />
                ))}
              </ul>
            </section>
          ))}
          <p className="pt-2 text-center text-xs text-muted-foreground">
            Swipe right when used · swipe left if thrown out
          </p>
        </>
      )}

      <ItemDetailSheet item={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
