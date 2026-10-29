"use client";

import { useState } from "react";
import { Link as LinkIcon, Plus, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useMeals } from "@/components/meals/meals-provider";
import { useItemActions } from "@/components/inventory/use-item-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addShoppingItem, removeShoppingItems, setChecked } from "@/lib/meals-client";
import { formatDayKey, formatIngredient, parseIngredientLine, type ShoppingItem } from "@/lib/meals";
import { defaultLocationFor, guessCategory } from "@/lib/shelfLife";
import { UNITS } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ShopPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { shopping, shoppingLoading } = useMeals();
  const actions = useItemActions();
  const [text, setText] = useState("");

  const visible = shopping.filter((i) => !i.hidden);
  const byName = (a: ShoppingItem, b: ShoppingItem) => a.name.localeCompare(b.name);
  const todo = visible.filter((i) => !i.checked).sort(byName);
  const done = visible.filter((i) => i.checked).sort(byName);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseIngredientLine(text);
    if (!parsed) return;
    addShoppingItem(uid, { name: parsed.name, qty: parsed.qty, unit: parsed.unit });
    setText("");
  }

  function addToInventory(item: ShoppingItem) {
    const category = guessCategory(item.name);
    const unit = item.unit && (UNITS as readonly string[]).includes(item.unit) ? item.unit : "item";
    actions.add([
      {
        name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
        category,
        quantity: unit === item.unit && item.qty ? item.qty : 1,
        unit,
        location: defaultLocationFor(category),
        expiresAt: null,
        expirySource: null,
      },
    ]);
  }

  function toggle(item: ShoppingItem, checked: boolean) {
    setChecked(uid, item.id, checked);
    if (checked) {
      toast(`Got ${item.name}`, { action: { label: "Add to inventory", onClick: () => addToInventory(item) } });
    }
  }

  function remove(items: ShoppingItem[], label: string) {
    const undo = removeShoppingItems(uid, items);
    toast(label, { action: { label: "Undo", onClick: undo } });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2">
        <Input
          aria-label="Add to shopping list"
          placeholder="Add an item, e.g. 2 lemons"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-11 text-base"
        />
        <Button type="submit" size="icon-touch" aria-label="Add" disabled={!text.trim()}>
          <Plus />
        </Button>
      </form>

      {shoppingLoading ? (
        <ul aria-busy="true" aria-label="Loading shopping list" className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-lg font-medium">Your list is empty</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Plan meals and anything you&apos;re missing shows up here automatically. Or add items above.
          </p>
          <Link href="/plan" className={buttonVariants({ size: "touch", variant: "outline" })}>
            Plan meals
          </Link>
        </div>
      ) : (
        <>
          {todo.length > 0 && (
            <ul className="space-y-2" aria-label="To buy">
              {todo.map((item) => (
                <ShopRow
                  key={item.id}
                  item={item}
                  onToggle={toggle}
                  onRemove={() => remove([item], `Removed ${item.name}`)}
                />
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <section aria-labelledby="in-cart" className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 id="in-cart" className="text-sm font-semibold">
                  In the cart <span className="font-normal text-muted-foreground">{done.length}</span>
                </h2>
                <Button
                  variant="ghost"
                  size="touch"
                  onClick={() => remove(done, `Cleared ${done.length} ${done.length === 1 ? "item" : "items"}`)}
                >
                  Clear
                </Button>
              </div>
              <ul className="space-y-2">
                {done.map((item) => (
                  <ShopRow
                    key={item.id}
                    item={item}
                    onToggle={toggle}
                    onAddToInventory={() => addToInventory(item)}
                    onRemove={() => remove([item], `Removed ${item.name}`)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ShopRow({
  item,
  onToggle,
  onRemove,
  onAddToInventory,
}: {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem, checked: boolean) => void;
  onRemove: () => void;
  onAddToInventory?: () => void;
}) {
  const id = `shop-${item.id}`;
  return (
    <li className="flex items-center gap-1 rounded-xl border bg-card pl-3">
      <input
        id={id}
        type="checkbox"
        checked={item.checked}
        onChange={(e) => onToggle(item, e.target.checked)}
        className="size-5 shrink-0 accent-primary"
      />
      <label htmlFor={id} className="flex min-h-12 min-w-0 flex-1 cursor-pointer flex-col justify-center py-1.5 pl-2">
        <span className={cn("truncate", item.checked && "text-muted-foreground line-through")}>
          {formatIngredient(item)}
        </span>
        {item.auto && item.fromMealDate && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <LinkIcon aria-hidden className="size-3" /> for {formatDayKey(item.fromMealDate, { weekday: "long" })}&apos;s meal
          </span>
        )}
      </label>
      {onAddToInventory && (
        <Button variant="ghost" size="touch" className="shrink-0 px-2 text-xs" onClick={onAddToInventory}>
          + Pantry
        </Button>
      )}
      <button
        type="button"
        aria-label={`Remove ${item.name}`}
        onClick={onRemove}
        className="flex size-11 shrink-0 items-center justify-center text-muted-foreground"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
