"use client";

import { useState } from "react";
import { ChevronRight, Clock, Plus, Sparkles } from "lucide-react";
import { useMeals } from "@/components/meals/meals-provider";
import { RecipeSheet } from "@/components/meals/recipe-sheet";
import { Button } from "@/components/ui/button";

export default function RecipesPage() {
  const { recipes, recipesLoading, openSuggestions } = useMeals();
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const open = selected === "new" ? "new" : (recipes.find((r) => r.id === selected) ?? null);

  return (
    <div className="space-y-4">
      <Button size="touch" variant="outline" className="w-full" onClick={() => setSelected("new")}>
        <Plus /> New recipe
      </Button>

      {recipesLoading ? (
        <ul aria-busy="true" aria-label="Loading recipes" className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </ul>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-lg font-medium">No saved recipes yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Save meal ideas you like, or write down your own favorites.
          </p>
          <Button size="touch" onClick={openSuggestions}>
            <Sparkles /> Get meal ideas
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {recipes.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                className="flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card p-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.title}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {r.timeMinutes != null && (
                      <span className="flex items-center gap-1">
                        <Clock aria-hidden className="size-3.5" /> {r.timeMinutes} min
                      </span>
                    )}
                    <span>
                      {r.ingredients.length} {r.ingredients.length === 1 ? "ingredient" : "ingredients"}
                    </span>
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <RecipeSheet recipe={open} onClose={() => setSelected(null)} />
    </div>
  );
}
