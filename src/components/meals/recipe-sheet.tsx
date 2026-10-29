"use client";

import { useState } from "react";
import { Check, Clock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory/inventory-provider";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteRecipe, saveRecipe } from "@/lib/meals-client";
import {
  findInventoryMatch,
  formatIngredient,
  ingredientsFromText,
  ingredientsToText,
  type Recipe,
} from "@/lib/meals";
import { AddToPlan } from "./add-to-plan";

/** `recipe: "new"` opens an empty form. */
export function RecipeSheet({ recipe, onClose }: { recipe: Recipe | "new" | null; onClose: () => void }) {
  const [shown, setShown] = useState(recipe);
  if (recipe && recipe !== shown) setShown(recipe);

  return (
    <Drawer open={recipe !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        {shown && (
          <RecipeDetail key={shown === "new" ? "new" : shown.id} recipe={shown === "new" ? null : shown} onClose={onClose} />
        )}
      </DrawerContent>
    </Drawer>
  );
}

const textareaClass =
  "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function RecipeDetail({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const [editing, setEditing] = useState(recipe === null);
  const [planning, setPlanning] = useState(false);
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { items } = useInventory();

  function remove() {
    if (!recipe) return;
    const undo = deleteRecipe(uid, recipe);
    toast(`Deleted ${recipe.title}`, { action: { label: "Undo", onClick: undo } });
    onClose();
  }

  return (
    <div className="pb-safe overflow-y-auto">
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-xl">{editing ? (recipe ? "Edit recipe" : "New recipe") : recipe?.title}</DrawerTitle>
        {!editing && recipe?.timeMinutes != null && (
          <DrawerDescription className="flex items-center gap-1">
            <Clock aria-hidden className="size-3.5" /> {recipe.timeMinutes} min
          </DrawerDescription>
        )}
      </DrawerHeader>

      <div className="space-y-4 p-4 pt-0">
        {editing ? (
          <RecipeForm
            recipe={recipe}
            onSave={(next) => {
              saveRecipe(uid, next);
              toast.success(recipe ? "Saved" : `Saved ${next.title}`);
              if (recipe) setEditing(false);
              else onClose();
            }}
          />
        ) : (
          recipe && (
            <>
              <section aria-labelledby="r-ingredients" className="space-y-1">
                <h3 id="r-ingredients" className="text-sm font-semibold">
                  Ingredients
                </h3>
                <ul className="space-y-1 text-sm">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {findInventoryMatch(ing.name, items) ? (
                        <Check aria-label="In your pantry" className="mt-0.5 size-4 shrink-0 text-primary" />
                      ) : (
                        <span aria-hidden className="mt-0.5 size-4 shrink-0" />
                      )}
                      {formatIngredient(ing)}
                    </li>
                  ))}
                </ul>
              </section>
              {recipe.steps.length > 0 && (
                <section aria-labelledby="r-steps" className="space-y-1">
                  <h3 id="r-steps" className="text-sm font-semibold">
                    Steps
                  </h3>
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {recipe.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </section>
              )}
              {recipe.notes && (
                <section aria-labelledby="r-notes" className="space-y-1">
                  <h3 id="r-notes" className="text-sm font-semibold">
                    Notes
                  </h3>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{recipe.notes}</p>
                </section>
              )}

              {planning ? (
                <AddToPlan
                  meal={{ title: recipe.title, recipeId: recipe.id, ingredients: recipe.ingredients, cooked: false }}
                  onAdded={onClose}
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button size="touch-lg" className="col-span-2" onClick={() => setPlanning(true)}>
                    Add to plan
                  </Button>
                  <Button size="touch-lg" variant="secondary" onClick={() => setEditing(true)}>
                    <Pencil /> Edit
                  </Button>
                  <Button size="touch-lg" variant="outline" onClick={remove}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}

function RecipeForm({ recipe, onSave }: { recipe: Recipe | null; onSave: (r: Omit<Recipe, "id"> & { id?: string }) => void }) {
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [time, setTime] = useState(recipe?.timeMinutes?.toString() ?? "");
  const [ingredients, setIngredients] = useState(recipe ? ingredientsToText(recipe.ingredients) : "");
  const [steps, setSteps] = useState(recipe?.steps.join("\n") ?? "");
  const [notes, setNotes] = useState(recipe?.notes ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const minutes = Number(time);
    onSave({
      id: recipe?.id,
      title: title.trim(),
      timeMinutes: time && Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
      ingredients: ingredientsFromText(ingredients),
      steps: steps
        .split("\n")
        .map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim())
        .filter(Boolean),
      notes: notes.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="r-title">Title</Label>
          <Input id="r-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-time">Minutes</Label>
          <Input
            id="r-time"
            type="number"
            inputMode="numeric"
            min={1}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-ingredients">Ingredients (one per line)</Label>
        <textarea
          id="r-ingredients"
          rows={5}
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          className={textareaClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-steps">Steps (one per line)</Label>
        <textarea id="r-steps" rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} className={textareaClass} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-notes">Notes</Label>
        <textarea id="r-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass} />
      </div>
      <Button type="submit" size="touch-lg" className="w-full" disabled={!title.trim()}>
        Save recipe
      </Button>
    </form>
  );
}
