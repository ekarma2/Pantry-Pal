"use client";

import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { commit, itemsCol, type Undo } from "@/lib/inventory";
import type { DayPlan, Ingredient, Meal, MealSlot, NeededItem, Recipe, ShoppingItem } from "@/lib/meals";
import type { InventoryItem } from "@/lib/types";

const planCol = (uid: string) => collection(firestore(), "users", uid, "mealPlan");
const recipesCol = (uid: string) => collection(firestore(), "users", uid, "recipes");
const shopCol = (uid: string) => collection(firestore(), "users", uid, "shoppingList");

// Firestore rejects `undefined`; store optional fields as null.
const cleanIngredients = (list: Ingredient[]) =>
  list.map((i) => ({ name: i.name, qty: i.qty ?? null, unit: i.unit ?? null, ...(i.staple ? { staple: true } : {}) }));

const cleanMeal = (m: Meal) => ({
  title: m.title,
  recipeId: m.recipeId ?? null,
  ingredients: cleanIngredients(m.ingredients),
  cooked: m.cooked,
});

function toIngredients(v: unknown): Ingredient[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i) => i && typeof i.name === "string")
    .map((i) => ({
      name: i.name,
      qty: typeof i.qty === "number" ? i.qty : null,
      unit: typeof i.unit === "string" ? i.unit : null,
      ...(i.staple ? { staple: true } : {}),
    }));
}

function toPlan(id: string, d: DocumentData): DayPlan {
  const slots: DayPlan["slots"] = {};
  for (const [slot, m] of Object.entries(d.slots ?? {})) {
    const meal = m as DocumentData | null;
    if (!meal?.title) continue;
    slots[slot as MealSlot] = {
      title: meal.title,
      recipeId: meal.recipeId ?? null,
      ingredients: toIngredients(meal.ingredients),
      cooked: meal.cooked === true,
    };
  }
  return { date: d.date ?? id, slots };
}

// ---------- Meal plan ----------

/** `fromServer` is false for snapshots served only from the offline cache. */
type OnSnap<T> = (data: T, fromServer: boolean) => void;

/** Plans with date in [from, to] ("YYYY-MM-DD", inclusive). */
export function subscribePlans(uid: string, from: string, to: string, onPlans: OnSnap<DayPlan[]>) {
  const q = query(planCol(uid), where("date", ">=", from), where("date", "<=", to));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => onPlans(snap.docs.map((d) => toPlan(d.id, d.data())), !snap.metadata.fromCache),
    (err) => console.error(err),
  );
}

export function setMeal(uid: string, date: string, slot: MealSlot, meal: Meal) {
  const batch = writeBatch(firestore());
  batch.set(doc(planCol(uid), date), { date, slots: { [slot]: cleanMeal(meal) } }, { merge: true });
  commit(batch);
}

export function removeMeal(uid: string, date: string, slot: MealSlot, meal: Meal): Undo {
  const batch = writeBatch(firestore());
  batch.set(doc(planCol(uid), date), { slots: { [slot]: deleteField() } }, { merge: true });
  commit(batch);
  return () => setMeal(uid, date, slot, meal);
}

export type IngredientUse = { item: InventoryItem; amount: number };

/** Marks a meal cooked and uses up the chosen inventory, in one undoable write. */
export function cookMeal(uid: string, date: string, slot: MealSlot, meal: Meal, uses: IngredientUse[]): Undo {
  const batch = writeBatch(firestore());
  const now = Timestamp.now();
  for (const { item, amount } of uses) {
    const remaining = item.quantity - amount;
    batch.update(
      doc(itemsCol(uid), item.id),
      remaining > 0 ? { quantity: remaining } : { status: "used", finishedAt: now },
    );
  }
  batch.set(doc(planCol(uid), date), { date, slots: { [slot]: { ...cleanMeal(meal), cooked: true } } }, { merge: true });
  commit(batch);

  return () => {
    const undo = writeBatch(firestore());
    for (const { item } of uses) {
      undo.update(doc(itemsCol(uid), item.id), { quantity: item.quantity, status: "active", finishedAt: null });
    }
    undo.set(doc(planCol(uid), date), { slots: { [slot]: { cooked: false } } }, { merge: true });
    commit(undo);
  };
}

// ---------- Recipes ----------

export function subscribeRecipes(uid: string, onRecipes: (recipes: Recipe[]) => void) {
  return onSnapshot(
    query(recipesCol(uid), orderBy("title")),
    (snap) =>
      onRecipes(
        snap.docs.map((d) => {
          const r = d.data();
          return {
            id: d.id,
            title: r.title ?? "",
            ingredients: toIngredients(r.ingredients),
            steps: Array.isArray(r.steps) ? r.steps.filter((s: unknown) => typeof s === "string") : [],
            timeMinutes: typeof r.timeMinutes === "number" ? r.timeMinutes : null,
            notes: typeof r.notes === "string" ? r.notes : null,
          };
        }),
      ),
    (err) => console.error(err),
  );
}

/** Creates (no id) or replaces a recipe; returns its id. */
export function saveRecipe(uid: string, recipe: Omit<Recipe, "id"> & { id?: string }): string {
  const ref = recipe.id ? doc(recipesCol(uid), recipe.id) : doc(recipesCol(uid));
  const batch = writeBatch(firestore());
  batch.set(ref, {
    title: recipe.title,
    ingredients: cleanIngredients(recipe.ingredients),
    steps: recipe.steps,
    timeMinutes: recipe.timeMinutes ?? null,
    notes: recipe.notes ?? null,
  });
  commit(batch);
  return ref.id;
}

export function deleteRecipe(uid: string, recipe: Recipe): Undo {
  const batch = writeBatch(firestore());
  batch.delete(doc(recipesCol(uid), recipe.id));
  commit(batch);
  return () => {
    saveRecipe(uid, recipe);
  };
}

// ---------- Shopping list ----------

export function subscribeShopping(uid: string, onItems: OnSnap<ShoppingItem[]>) {
  return onSnapshot(
    shopCol(uid),
    { includeMetadataChanges: true },
    (snap) =>
      onItems(
        snap.docs.map((d) => {
          const s = d.data();
          return {
            id: d.id,
            name: s.name ?? "",
            qty: typeof s.qty === "number" ? s.qty : null,
            unit: typeof s.unit === "string" ? s.unit : null,
            checked: s.checked === true,
            fromMealDate: typeof s.fromMealDate === "string" ? s.fromMealDate : null,
            auto: s.auto === true,
            hidden: s.hidden === true,
          };
        }),
        !snap.metadata.fromCache,
      ),
    (err) => console.error(err),
  );
}

export function addShoppingItem(uid: string, item: Pick<ShoppingItem, "name" | "qty" | "unit">) {
  const batch = writeBatch(firestore());
  batch.set(doc(shopCol(uid)), { ...item, checked: false, fromMealDate: null, auto: false, hidden: false });
  commit(batch);
}

export function setChecked(uid: string, id: string, checked: boolean) {
  const batch = writeBatch(firestore());
  batch.update(doc(shopCol(uid), id), { checked });
  commit(batch);
}

/**
 * Removes items from the list. Auto items are hidden rather than deleted so the
 * sync doesn't put them straight back while their meal is still planned.
 */
export function removeShoppingItems(uid: string, items: ShoppingItem[]): Undo {
  const write = (restore: boolean) => {
    const batch = writeBatch(firestore());
    for (const item of items) {
      const ref = doc(shopCol(uid), item.id);
      if (item.auto) batch.update(ref, { hidden: !restore });
      else if (restore) {
        const { id, ...rest } = item;
        void id;
        batch.set(ref, rest);
      } else batch.delete(ref);
    }
    commit(batch);
  };
  write(false);
  return () => write(true);
}

/**
 * Makes the auto part of the list match the plan: adds newly missing
 * ingredients, and drops auto items no longer needed (unless already ticked off).
 */
export function syncShopping(uid: string, needed: NeededItem[], current: ShoppingItem[]) {
  const byId = new Map(current.map((i) => [i.id, i]));
  const neededIds = new Set(needed.map((n) => n.id));
  const batch = writeBatch(firestore());
  let writes = 0;

  for (const n of needed) {
    if (byId.has(n.id)) continue;
    batch.set(doc(shopCol(uid), n.id), {
      name: n.name,
      qty: n.qty,
      unit: n.unit,
      checked: false,
      fromMealDate: n.fromMealDate,
      auto: true,
      hidden: false,
    });
    writes++;
  }
  for (const item of current) {
    if (item.auto && !neededIds.has(item.id) && (!item.checked || item.hidden)) {
      batch.delete(doc(shopCol(uid), item.id));
      writes++;
    }
  }
  if (writes) commit(batch);
}
