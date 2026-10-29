"use client";

import { useState } from "react";
import { BookmarkPlus, Check, ChefHat, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory/inventory-provider";
import { selectClass } from "@/components/inventory/item-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeMeal, saveRecipe, setMeal } from "@/lib/meals-client";
import {
  findInventoryMatch,
  formatDayKey,
  formatIngredient,
  ingredientsFromText,
  ingredientsToText,
  SLOT_LABEL,
  type Meal,
  type MealSlot,
} from "@/lib/meals";
import { CookPanel } from "./cook-panel";
import { useMeals } from "./meals-provider";

export type SlotTarget = { date: string; slot: MealSlot; meal: Meal | null };

type Mode = "view" | "edit" | "cook";

export function MealSheet({ target, onClose }: { target: SlotTarget | null; onClose: () => void }) {
  // Keep showing the last slot while the sheet animates closed.
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);

  return (
    <Drawer open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        {shown && (
          <MealDetail
            key={`${shown.date}-${shown.slot}-${shown.meal ? "meal" : "empty"}`}
            target={shown}
            onClose={onClose}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function MealDetail({ target, onClose }: { target: SlotTarget; onClose: () => void }) {
  const { date, slot, meal } = target;
  const [mode, setMode] = useState<Mode>(meal ? "view" : "edit");
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { items } = useInventory();
  const { recipes } = useMeals();
  const recipe = meal?.recipeId ? recipes.find((r) => r.id === meal.recipeId) : undefined;
  const when = `${formatDayKey(date, { weekday: "long", month: "short", day: "numeric" })} · ${SLOT_LABEL[slot]}`;

  function remove() {
    if (!meal) return;
    const undo = removeMeal(uid, date, slot, meal);
    toast(`Removed ${meal.title}`, { action: { label: "Undo", onClick: undo } });
    onClose();
  }

  function saveAsRecipe() {
    if (!meal) return;
    const id = saveRecipe(uid, { title: meal.title, ingredients: meal.ingredients, steps: [], timeMinutes: null, notes: null });
    setMeal(uid, date, slot, { ...meal, recipeId: id });
    toast.success(`Saved “${meal.title}” to Recipes`);
  }

  return (
    <div className="pb-safe overflow-y-auto">
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-xl">
          {mode === "edit" ? (meal ? "Edit meal" : "Plan a meal") : mode === "cook" ? `Cook ${meal?.title}` : meal?.title}
        </DrawerTitle>
        <DrawerDescription>{when}</DrawerDescription>
        {mode === "view" && meal?.cooked && (
          <div className="pt-1">
            <Badge>
              <Check /> Cooked
            </Badge>
          </div>
        )}
      </DrawerHeader>

      <div className="p-4 pt-0">
        {mode === "edit" && (
          <MealForm
            meal={meal}
            onSave={(next) => {
              setMeal(uid, date, slot, next);
              toast.success(meal ? "Saved" : `Planned ${next.title}`);
              onClose();
            }}
          />
        )}

        {mode === "cook" && meal && (
          <CookPanel date={date} slot={slot} meal={meal} onDone={onClose} onCancel={() => setMode("view")} />
        )}

        {mode === "view" && meal && (
          <div className="space-y-4">
            {meal.ingredients.length > 0 ? (
              <ul className="space-y-1 text-sm" aria-label="Ingredients">
                {meal.ingredients.map((ing, i) => {
                  const have = !!findInventoryMatch(ing.name, items);
                  return (
                    <li key={i} className="flex items-start gap-2">
                      {have ? (
                        <Check aria-label="In your pantry" className="mt-0.5 size-4 shrink-0 text-primary" />
                      ) : (
                        <span aria-hidden className="mt-0.5 size-4 shrink-0" />
                      )}
                      <span className={ing.staple ? "text-muted-foreground" : undefined}>{formatIngredient(ing)}</span>
                      {!have && !ing.staple && !meal.cooked && (
                        <Badge variant="outline" className="ml-auto shrink-0">
                          on list
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No ingredients listed.</p>
            )}

            {recipe && recipe.steps.length > 0 && (
              <details className="text-sm">
                <summary className="flex min-h-11 cursor-pointer items-center font-medium">Steps</summary>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  {recipe.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </details>
            )}

            <div className="grid grid-cols-2 gap-2">
              {!meal.cooked && (
                <Button size="touch-lg" className="col-span-2" onClick={() => setMode("cook")}>
                  <ChefHat /> Mark as cooked
                </Button>
              )}
              <Button size="touch-lg" variant="secondary" onClick={() => setMode("edit")}>
                <Pencil /> Edit
              </Button>
              <Button size="touch-lg" variant="outline" onClick={remove}>
                <Trash2 /> Remove
              </Button>
              {!meal.recipeId && (
                <Button size="touch-lg" variant="ghost" className="col-span-2" onClick={saveAsRecipe}>
                  <BookmarkPlus /> Save as recipe
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MealForm({ meal, onSave }: { meal: Meal | null; onSave: (meal: Meal) => void }) {
  const { recipes } = useMeals();
  const [title, setTitle] = useState(meal?.title ?? "");
  const [ingredients, setIngredients] = useState(meal ? ingredientsToText(meal.ingredients) : "");
  const [recipeId, setRecipeId] = useState<string | null>(meal?.recipeId ?? null);

  function pickRecipe(id: string) {
    const r = recipes.find((x) => x.id === id);
    if (!r) return;
    setRecipeId(r.id);
    setTitle(r.title);
    setIngredients(ingredientsToText(r.ingredients));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    // Keep the staple flags of ingredients that survive the edit.
    const staples = new Set((meal?.ingredients ?? []).filter((i) => i.staple).map((i) => formatIngredient(i)));
    const list = ingredientsFromText(ingredients).map((i) =>
      staples.has(formatIngredient(i)) ? { ...i, staple: true } : i,
    );
    onSave({ title: title.trim(), recipeId, ingredients: list, cooked: meal?.cooked ?? false });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {recipes.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="meal-recipe">From a saved recipe</Label>
          <select
            id="meal-recipe"
            className={selectClass}
            value={recipeId ?? ""}
            onChange={(e) => pickRecipe(e.target.value)}
          >
            <option value="">—</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="meal-title">Meal</Label>
        <Input
          id="meal-title"
          required
          autoFocus={!meal}
          placeholder="e.g. Chicken stir-fry"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="meal-ingredients">Ingredients (optional, one per line)</Label>
        <textarea
          id="meal-ingredients"
          rows={5}
          placeholder={"2 chicken breasts\n1 bag spinach\nsoy sauce"}
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground">Anything you don&apos;t have goes on your shopping list.</p>
      </div>
      <Button type="submit" size="touch-lg" className="w-full" disabled={!title.trim()}>
        Save
      </Button>
    </form>
  );
}
