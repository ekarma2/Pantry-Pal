"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fromInputDate, toInputDate } from "@/lib/dates";
import { defaultLocationFor, tableShelfLifeDays } from "@/lib/shelfLife";
import { CATEGORIES, LOCATIONS, UNITS, type ExpirySource, type InventoryItem, type NewItem } from "@/lib/types";
import { LOCATION_LABEL, LocationIcon } from "./location-icon";

export const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type Props = {
  initial?: InventoryItem;
  submitLabel: string;
  onSubmit: (item: NewItem) => void;
  onCancel?: () => void;
  onDelete?: () => void;
};

export function ItemForm({ initial, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [unit, setUnit] = useState(initial?.unit ?? "item");
  const [category, setCategory] = useState(initial?.category ?? "other");
  const [location, setLocation] = useState(initial?.location ?? "fridge");
  const [locationTouched, setLocationTouched] = useState(Boolean(initial));
  const [expiresOn, setExpiresOn] = useState(toInputDate(initial?.expiresAt ?? null));
  const tableDays = tableShelfLifeDays(name, category, location);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    const expiresAt = fromInputDate(expiresOn);
    const dateChanged = expiresOn !== toInputDate(initial?.expiresAt ?? null);
    const expirySource: ExpirySource | null = !expiresAt
      ? null
      : dateChanged
        ? "user"
        : (initial?.expirySource ?? "user");

    onSubmit({
      name: name.trim(),
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      unit,
      category,
      location,
      expiresAt,
      expirySource,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="item-name">Name</Label>
        <Input
          id="item-name"
          className="h-11 text-base"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Greek yogurt"
          autoComplete="off"
          required
          autoFocus={!initial}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="item-qty">Quantity</Label>
          <Input
            id="item-qty"
            className="h-11 text-base"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-unit">Unit</Label>
          <select id="item-unit" className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
            {!UNITS.includes(unit as (typeof UNITS)[number]) && <option value={unit}>{unit}</option>}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-category">Category</Label>
        <select
          id="item-category"
          className={cn(selectClass, "capitalize")}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (!locationTouched) setLocation(defaultLocationFor(e.target.value));
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          {!CATEGORIES.includes(category as (typeof CATEGORIES)[number]) && <option value={category}>{category}</option>}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Location</legend>
        <div className="grid grid-cols-3 gap-2">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              aria-pressed={location === loc}
              onClick={() => {
                setLocation(loc);
                setLocationTouched(true);
              }}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-lg border text-sm",
                location === loc ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <LocationIcon location={loc} className="size-4" />
              {LOCATION_LABEL[loc]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="item-expiry">Expiry date (optional)</Label>
        <div className="flex gap-2">
          <Input
            id="item-expiry"
            className="h-11 flex-1 text-base"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
          {expiresOn && (
            <Button type="button" variant="ghost" size="touch" onClick={() => setExpiresOn("")}>
              Clear
            </Button>
          )}
        </div>
        {!expiresOn && name.trim() && (
          <p className="text-sm text-muted-foreground">
            {tableDays != null
              ? `We'll estimate about ${tableDays} ${tableDays === 1 ? "day" : "days"} in the ${LOCATION_LABEL[location].toLowerCase()}.`
              : "We'll estimate a date with AI after you save."}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button type="submit" size="touch-lg" disabled={!name.trim()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="touch" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {onDelete && (
          <Button type="button" variant="destructive" size="touch" onClick={onDelete}>
            Delete item
          </Button>
        )}
      </div>
    </form>
  );
}
