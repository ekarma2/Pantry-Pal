"use client";

import { useState } from "react";
import { BookmarkCheck, BookmarkPlus, CalendarPlus, Check, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory/inventory-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { deleteRecipe, saveRecipe } from "@/lib/meals-client";
import { formatIngredient, namesMatch, type Ingredient, type Meal, type MealSuggestion } from "@/lib/meals";
import type { InventoryItem } from "@/lib/types";
import { AddToPlan } from "./add-to-plan";
import { useMeals } from "./meals-provider";

/** Suggestion -> planner/recipe ingredients, named so they match the inventory item they use. */
function toIngredients(meal: MealSuggestion, items: InventoryItem[]): Ingredient[] {
  return meal.ingredients.map((i) => {
    const item = i.inventoryItemId ? items.find((x) => x.id === i.inventoryItemId) : undefined;
    const name = item && !namesMatch(i.name, item.name) ? item.name : i.name;
    return { name, qty: i.qty, unit: i.unit, ...(i.staple ? { staple: true } : {}) };
  });
}

export function SuggestSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { suggestions, requestSuggestions } = useMeals();
  const { items } = useInventory();
  const [preferences, setPreferences] = useState("");
  const loading = suggestions.status === "loading";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    requestSuggestions(preferences);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="pb-safe overflow-y-auto">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl">What should I cook?</DrawerTitle>
            <DrawerDescription>Meal ideas that use up what expires first.</DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 p-4 pt-0">
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Add some food to your pantry first, then we can suggest meals with it.
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-2">
                <Input
                  aria-label="Preferences (optional)"
                  placeholder="Optional: vegetarian, under 30 min, no nuts…"
                  value={preferences}
                  maxLength={300}
                  onChange={(e) => setPreferences(e.target.value)}
                  className="h-11 text-base"
                />
                <Button type="submit" size="touch-lg" className="w-full" disabled={loading}>
                  <Sparkles /> {suggestions.status === "done" ? "New ideas" : loading ? "Thinking…" : "Suggest meals"}
                </Button>
              </form>
            )}

            {loading && (
              <div aria-busy="true" aria-live="polite" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Finding meals that use what&apos;s expiring… You can close this; we&apos;ll let you know.
                </p>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            )}

            {suggestions.status === "error" && (
              <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
                {suggestions.error}
              </p>
            )}

            {suggestions.status === "done" && (
              <ul className="space-y-3" aria-label="Meal ideas">
                {suggestions.meals.map((meal, i) => (
                  <SuggestionCard key={`${i}-${meal.title}`} meal={meal} items={items} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SuggestionCard({ meal, items }: { meal: MealSuggestion; items: InventoryItem[] }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const [planning, setPlanning] = useState(false);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const ingredients = toIngredients(meal, items);
  const missing = meal.ingredients.filter((i) => !i.inventoryItemId && !i.staple).length;

  function save() {
    const recipe = { title: meal.title, ingredients, steps: meal.steps, timeMinutes: meal.timeMinutes, notes: null };
    const id = saveRecipe(uid, recipe);
    setRecipeId(id);
    toast(`Saved “${meal.title}” to Recipes`, {
      action: {
        label: "Undo",
        onClick: () => {
          deleteRecipe(uid, { id, ...recipe });
          setRecipeId(null);
        },
      },
    });
  }

  const asMeal: Meal = { title: meal.title, recipeId, ingredients, cooked: false };

  return (
    <li className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{meal.title}</h3>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock aria-hidden className="size-3.5" /> {meal.timeMinutes} min
          </span>
          <span>{missing === 0 ? "You have everything" : `${missing} to buy`}</span>
        </p>
        {meal.usesExpiring.length > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400">Uses up: {meal.usesExpiring.join(", ")}</p>
        )}
      </div>

      <ul className="space-y-1 text-sm" aria-label="Ingredients">
        {meal.ingredients.map((ing, i) => (
          <li key={i} className="flex items-start gap-2">
            {ing.inventoryItemId ? (
              <Check aria-label="In your pantry" className="mt-0.5 size-4 shrink-0 text-primary" />
            ) : (
              <span aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            <span className={ing.staple ? "text-muted-foreground" : undefined}>{formatIngredient(ing)}</span>
            {!ing.inventoryItemId && !ing.staple && (
              <Badge variant="outline" className="ml-auto shrink-0">
                need
              </Badge>
            )}
          </li>
        ))}
      </ul>

      <details className="text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">Steps</summary>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          {meal.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </details>

      {planning ? (
        <AddToPlan meal={asMeal} onAdded={() => setPlanning(false)} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button size="touch" onClick={() => setPlanning(true)}>
            <CalendarPlus /> Add to plan
          </Button>
          <Button size="touch" variant="outline" disabled={!!recipeId} onClick={save}>
            {recipeId ? (
              <>
                <BookmarkCheck /> Saved
              </>
            ) : (
              <>
                <BookmarkPlus /> Save recipe
              </>
            )}
          </Button>
        </div>
      )}
    </li>
  );
}
