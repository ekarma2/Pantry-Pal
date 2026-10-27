"use client";

import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectClass } from "@/components/inventory/item-form";
import { LOCATION_LABEL, LocationIcon } from "@/components/inventory/location-icon";
import { useSwipe } from "@/hooks/use-swipe";
import { useToday } from "@/hooks/use-today";
import { LOCATIONS, UNITS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { moveDraft, type Draft } from "./drafts";

type Props = {
  drafts: Draft[];
  onChange: (updater: (drafts: Draft[]) => Draft[]) => void;
  onAddAll: () => void;
  onBack: () => void;
};

/** Review & Confirm: fix anything the parser got wrong, then add everything in one tap. */
export function ReviewList({ drafts, onChange, onAddAll, onBack }: Props) {
  const today = useToday();

  function update(key: string, fn: (d: Draft) => Draft) {
    onChange((ds) => ds.map((d) => (d.key === key ? fn(d) : d)));
  }

  function remove(key: string) {
    const index = drafts.findIndex((d) => d.key === key);
    const removed = drafts[index];
    if (!removed) return;
    onChange((ds) => ds.filter((d) => d.key !== key));
    toast(`Removed ${removed.name || "item"}`, {
      action: {
        label: "Undo",
        onClick: () =>
          onChange((ds) => {
            const next = [...ds];
            next.splice(Math.min(index, next.length), 0, removed);
            return next;
          }),
      },
    });
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-medium">Nothing to add</p>
        <Button variant="outline" size="touch" onClick={onBack}>Try again</Button>
      </div>
    );
  }

  const invalid = drafts.some((d) => !d.name.trim());

  return (
    <div>
      <ul className="space-y-3">
        {drafts.map((d) => (
          <ReviewRow
            key={d.key}
            draft={d}
            onUpdate={(fn) => update(d.key, fn)}
            onMove={(loc) => update(d.key, (x) => moveDraft(x, loc, today))}
            onRemove={() => remove(d.key)}
          />
        ))}
      </ul>
      <p className="py-3 text-center text-xs text-muted-foreground">Swipe an item away to remove it</p>

      <div className="sticky bottom-0 -mx-4 border-t bg-popover px-4 pb-2 pt-3">
        {invalid && <p className="pb-2 text-center text-sm text-muted-foreground">Give every item a name to add them.</p>}
        <Button size="touch-lg" className="w-full" onClick={onAddAll} disabled={invalid}>
          Add all ({drafts.length})
        </Button>
      </div>
    </div>
  );
}

function ReviewRow({
  draft: d,
  onUpdate,
  onMove,
  onRemove,
}: {
  draft: Draft;
  onUpdate: (fn: (d: Draft) => Draft) => void;
  onMove: (loc: Draft["location"]) => void;
  onRemove: () => void;
}) {
  const { dx, dragging, past, handlers } = useSwipe({ onSwipeLeft: onRemove, onSwipeRight: onRemove });
  const estimated = d.expirySource === "table" || d.expirySource === "ai";
  const id = `draft-${d.key}`;

  return (
    <li className="relative overflow-hidden rounded-xl">
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center px-5 text-sm font-medium text-white",
          dx > 0 ? "justify-start" : "justify-end",
          past ? "bg-red-600" : "bg-red-600/60",
          dx === 0 && "invisible",
        )}
      >
        Remove
      </div>

      <div
        {...handlers}
        style={{ transform: `translateX(${dx}px)` }}
        className={cn(
          "relative touch-pan-y space-y-2 rounded-xl border bg-card p-3",
          !dragging && "transition-transform duration-200",
          d.confidence === "low" && "border-amber-500",
        )}
      >
        <div className="flex items-center gap-2">
          <Input
            aria-label="Name"
            value={d.name}
            placeholder={d.barcode ? "What is this?" : undefined}
            autoFocus={!d.name && Boolean(d.barcode)}
            onChange={(e) => onUpdate((x) => ({ ...x, name: e.target.value }))}
            className="h-11 flex-1 text-base font-medium"
          />
          <Button variant="ghost" size="icon-touch" aria-label={`Remove ${d.name}`} onClick={onRemove}>
            <X />
          </Button>
        </div>

        {d.confidence === "low" && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3.5" aria-hidden />
            {d.barcode && !d.name.trim()
              ? `Unknown barcode ${d.barcode}. Name it and we'll remember it next time.`
              : "Not sure about this one. Please check it."}
          </p>
        )}

        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <Input
            aria-label="Quantity"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={d.qty}
            onChange={(e) => onUpdate((x) => ({ ...x, qty: e.target.value }))}
            className="h-11 text-base"
          />
          <select
            aria-label="Unit"
            className={selectClass}
            value={d.unit}
            onChange={(e) => onUpdate((x) => ({ ...x, unit: e.target.value }))}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
            {!UNITS.includes(d.unit as (typeof UNITS)[number]) && <option value={d.unit}>{d.unit}</option>}
          </select>
        </div>

        <div role="group" aria-label="Location" className="grid grid-cols-3 gap-2">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              aria-pressed={d.location === loc}
              onClick={() => onMove(loc)}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm",
                d.location === loc ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <LocationIcon location={loc} className="size-4" />
              {LOCATION_LABEL[loc]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-expiry`} className="shrink-0 text-sm text-muted-foreground">
            Expires
          </label>
          <Input
            id={`${id}-expiry`}
            type="date"
            value={d.expiresOn}
            onChange={(e) =>
              onUpdate((x) => ({ ...x, expiresOn: e.target.value, expirySource: e.target.value ? "user" : null }))
            }
            className="h-11 flex-1 text-base"
          />
          {estimated && d.expiresOn && <Badge variant="outline">estimated</Badge>}
        </div>
        {!d.expiresOn && <p className="text-xs text-muted-foreground">We&apos;ll estimate a date after adding.</p>}
      </div>
    </li>
  );
}
