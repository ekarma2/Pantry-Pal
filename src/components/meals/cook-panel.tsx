"use client";

import { useState } from "react";
import { ChefHat } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory/inventory-provider";
import { selectClass } from "@/components/inventory/item-form";
import { defaultUseAmount } from "@/components/inventory/use-item-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compareByExpiry } from "@/lib/freshness";
import { cookMeal } from "@/lib/meals-client";
import { findInventoryMatch, type Ingredient, type Meal, type MealSlot } from "@/lib/meals";
import { COUNT_UNITS, type InventoryItem } from "@/lib/types";

/** How much of `item` cooking `ing` uses, when the units line up; otherwise the usual "used it" amount. */
function cookAmount(ing: Ingredient | null, item: InventoryItem): number {
  if (ing?.qty != null) {
    const sameUnit = ing.unit === item.unit || (!ing.unit && COUNT_UNITS.has(item.unit));
    if (sameUnit) return Math.min(ing.qty, item.quantity);
  }
  return defaultUseAmount(item);
}

type Row = { item: InventoryItem; amount: number; on: boolean };

/** "Mark as cooked": pick the inventory items used; they're decremented in one undoable write. */
export function CookPanel({
  date,
  slot,
  meal,
  onDone,
  onCancel,
}: {
  date: string;
  slot: MealSlot;
  meal: Meal;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const { items } = useInventory();
  const [rows, setRows] = useState<Row[]>(() => {
    const seen = new Set<string>();
    const matched: Row[] = [];
    for (const ing of meal.ingredients) {
      const item = findInventoryMatch(ing.name, items);
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        matched.push({ item, amount: cookAmount(ing, item), on: true });
      }
    }
    return matched;
  });

  const others = [...items].sort(compareByExpiry).filter((i) => !rows.some((r) => r.item.id === i.id));
  const chosen = rows.filter((r) => r.on && r.amount > 0);

  function patch(id: string, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.item.id === id ? { ...r, ...p } : r)));
  }

  function confirm() {
    const undo = cookMeal(
      user?.uid ?? "",
      date,
      slot,
      meal,
      chosen.map((r) => ({ item: r.item, amount: Math.min(r.amount, r.item.quantity) })),
    );
    const used = chosen.length;
    toast(used ? `Cooked ${meal.title} · used ${used} ${used === 1 ? "item" : "items"}` : `Cooked ${meal.title}`, {
      action: { label: "Undo", onClick: undo },
    });
    onDone();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {rows.length ? "Tick what you used. Amounts come off your pantry." : "Nothing in your pantry matched this meal's ingredients. Add anything you used below."}
      </p>

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map(({ item, amount, on }) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl border p-2 pl-3">
              <input
                id={`use-${item.id}`}
                type="checkbox"
                checked={on}
                onChange={(e) => patch(item.id, { on: e.target.checked })}
                className="size-5 shrink-0 accent-primary"
              />
              <label htmlFor={`use-${item.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  have {item.quantity} {item.unit}
                </span>
              </label>
              <Input
                type="number"
                inputMode="decimal"
                aria-label={`Amount of ${item.name} used`}
                min={0}
                max={item.quantity}
                step="any"
                value={amount}
                disabled={!on}
                onChange={(e) => patch(item.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
                className="h-11 w-20 text-base"
              />
              <span className="w-10 shrink-0 text-xs text-muted-foreground">{item.unit}</span>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <select
          aria-label="Add another item you used"
          className={selectClass}
          value=""
          onChange={(e) => {
            const item = items.find((i) => i.id === e.target.value);
            if (item) setRows((rs) => [...rs, { item, amount: cookAmount(null, item), on: true }]);
          }}
        >
          <option value="">+ Another item you used…</option>
          {others.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.quantity} {i.unit})
            </option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button size="touch-lg" variant="outline" onClick={onCancel}>
          Back
        </Button>
        <Button size="touch-lg" onClick={confirm}>
          <ChefHat /> Mark cooked
        </Button>
      </div>
    </div>
  );
}
