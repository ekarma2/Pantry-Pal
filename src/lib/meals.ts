// Meal planning model (spec §5): mealPlan, recipes, shoppingList. Pure helpers only.

import { addDays, fromInputDate, startOfDay, toInputDate } from "@/lib/dates";
import { compareByExpiry } from "@/lib/freshness";
import type { InventoryItem } from "@/lib/types";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export type Ingredient = {
  name: string;
  qty: number | null;
  unit: string | null;
  /** Salt, oil, water…: assumed on hand, never added to the shopping list. */
  staple?: boolean;
};

export type Meal = { title: string; recipeId: string | null; ingredients: Ingredient[]; cooked: boolean };

/** users/{uid}/mealPlan/{YYYY-MM-DD} */
export type DayPlan = { date: string; slots: Partial<Record<MealSlot, Meal>> };

export type Recipe = {
  id: string;
  title: string;
  ingredients: Ingredient[];
  steps: string[];
  timeMinutes: number | null;
  notes: string | null;
};

export type ShoppingItem = {
  id: string;
  name: string;
  qty: number | null;
  unit: string | null;
  checked: boolean;
  fromMealDate: string | null;
  /** Rolled in from a planned meal (kept in sync), vs. typed by hand. */
  auto: boolean;
  /** An auto item the user removed; kept so the sync doesn't re-add it. */
  hidden: boolean;
};

export type SuggestedIngredient = Ingredient & { inventoryItemId: string | null };

export type MealSuggestion = {
  title: string;
  timeMinutes: number;
  ingredients: SuggestedIngredient[];
  steps: string[];
  /** Names of soon-expiring inventory items this meal uses. */
  usesExpiring: string[];
};

/** What the client sends /api/suggest-meals for each inventory item. */
export type SuggestInventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  daysLeft: number | null;
};

// ---------- Dates ----------

export const dateKey = (d: Date) => toInputDate(d);

/** Monday of the week containing `d`. */
export function weekStart(d: Date): Date {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatDayKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short" }): string {
  return fromInputDate(key)?.toLocaleDateString(undefined, opts) ?? key;
}

// ---------- Ingredients ----------

const FRACTIONS: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75 };

const UNIT_WORDS: Record<string, string> = {
  item: "item", items: "item", pack: "pack", packs: "pack", bag: "bag", bags: "bag", box: "box", boxes: "box",
  can: "can", cans: "can", jar: "jar", jars: "jar", bottle: "bottle", bottles: "bottle", bunch: "bunch",
  bunches: "bunch", dozen: "dozen", g: "g", gram: "g", grams: "g", kg: "kg", oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb", ml: "ml", l: "L", liter: "L", liters: "L",
  cup: "cup", cups: "cup", tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tsp: "tsp", teaspoon: "tsp",
  teaspoons: "tsp", clove: "clove", cloves: "clove", slice: "slice", slices: "slice", pinch: "pinch",
};

function parseQty(s: string): number | null {
  if (FRACTIONS[s] != null) return FRACTIONS[s];
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(s);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "2 lb chicken breast", "1 1/2 cups milk", "spinach" -> Ingredient. */
export function parseIngredientLine(line: string): Ingredient | null {
  const text = line.replace(/^[-*•\s]+/, "").trim();
  if (!text) return null;
  const m = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+|[½⅓⅔¼¾])\s*(.*)$/.exec(text);
  if (!m) return { name: text, qty: null, unit: null };
  const qty = parseQty(m[1]);
  const [first, ...rest] = m[2].split(/\s+/);
  const unit = first ? UNIT_WORDS[first.toLowerCase().replace(/\.$/, "")] : undefined;
  const name = (unit ? rest.join(" ") : m[2]).replace(/^of\s+/i, "").trim();
  return name ? { name, qty, unit: unit ?? null } : { name: text, qty: null, unit: null };
}

const trimNum = (n: number) => String(Math.round(n * 100) / 100);

export function formatIngredient(i: Pick<Ingredient, "name" | "qty" | "unit">): string {
  if (i.qty == null) return i.name;
  const unit = i.unit && i.unit !== "item" ? ` ${i.unit}` : "";
  return `${trimNum(i.qty)}${unit} ${i.name}`;
}

export const ingredientsToText = (list: Ingredient[]) => list.map(formatIngredient).join("\n");

export function ingredientsFromText(text: string): Ingredient[] {
  return text
    .split("\n")
    .map(parseIngredientLine)
    .filter((i): i is Ingredient => i !== null);
}

// ---------- Matching ingredients to inventory ----------

function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singular);
}

/** "spinach" matches "Baby spinach"; "chicken breasts" matches "Chicken breast". */
export function namesMatch(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  const [short, long] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  return short.every((t) => long.has(t));
}

/** The soonest-expiring active item matching an ingredient name. */
export function findInventoryMatch(name: string, items: InventoryItem[]): InventoryItem | null {
  return [...items].sort(compareByExpiry).find((i) => namesMatch(name, i.name)) ?? null;
}

export const shoppingKey = (name: string) => `auto-${nameTokens(name).join("-").slice(0, 80) || "item"}`;

export type NeededItem = { id: string; name: string; qty: number | null; unit: string | null; fromMealDate: string };

/** Missing ingredients of uncooked meals from `fromDate` on: what the shopping list should contain. */
export function neededFromPlans(plans: DayPlan[], items: InventoryItem[], fromDate: string): NeededItem[] {
  const needed = new Map<string, NeededItem>();
  for (const plan of [...plans].sort((a, b) => a.date.localeCompare(b.date))) {
    if (plan.date < fromDate) continue;
    for (const slot of MEAL_SLOTS) {
      const meal = plan.slots[slot];
      if (!meal || meal.cooked) continue;
      for (const ing of meal.ingredients) {
        if (ing.staple || findInventoryMatch(ing.name, items)) continue;
        const id = shoppingKey(ing.name);
        const dup = needed.has(id) || [...needed.values()].some((n) => namesMatch(n.name, ing.name));
        if (!dup) {
          needed.set(id, { id, name: ing.name, qty: ing.qty, unit: ing.unit, fromMealDate: plan.date });
        }
      }
    }
  }
  return [...needed.values()];
}

/** The first empty dinner slot from today on (where "Add to plan" defaults). */
export function nextOpenSlot(plans: DayPlan[], today: Date): { date: string; slot: MealSlot } {
  for (let i = 0; i < 14; i++) {
    const date = dateKey(addDays(today, i));
    if (!plans.find((p) => p.date === date)?.slots.dinner) return { date, slot: "dinner" };
  }
  return { date: dateKey(today), slot: "dinner" };
}
