"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory/inventory-provider";
import { useToday } from "@/hooks/use-today";
import { apiFetch } from "@/lib/api";
import { addDays, daysUntil } from "@/lib/dates";
import { compareByExpiry } from "@/lib/freshness";
import { subscribePlans, subscribeRecipes, subscribeShopping, syncShopping } from "@/lib/meals-client";
import {
  dateKey,
  neededFromPlans,
  type DayPlan,
  type MealSuggestion,
  type Recipe,
  type ShoppingItem,
  type SuggestInventoryItem,
} from "@/lib/meals";
import { SuggestSheet } from "./suggest-sheet";

export type Suggestions =
  | { status: "idle" }
  | { status: "loading"; preferences: string }
  | { status: "done"; preferences: string; meals: MealSuggestion[] }
  | { status: "error"; preferences: string; error: string };

type MealsState = {
  recipes: Recipe[];
  recipesLoading: boolean;
  shopping: ShoppingItem[];
  shoppingLoading: boolean;
  /** Plans from today through the next two weeks (shopping list + "next open slot"). */
  upcoming: DayPlan[];
  suggestions: Suggestions;
  requestSuggestions: (preferences: string) => void;
  openSuggestions: () => void;
};

const MealsContext = createContext<MealsState | null>(null);

const UPCOMING_DAYS = 14;

/** Recipes, shopping list, upcoming plans and "What should I cook?", shared by every screen. */
export function MealsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const { items, loading: inventoryLoading } = useInventory();
  const today = useToday();
  const from = dateKey(today);
  const to = dateKey(addDays(today, UPCOMING_DAYS - 1));

  const [recipes, setRecipes] = useState({ list: [] as Recipe[], loading: true });
  const [shopping, setShopping] = useState({ list: [] as ShoppingItem[], loading: true, synced: false });
  const [upcoming, setUpcoming] = useState({ list: [] as DayPlan[], synced: false });
  const [suggestions, setSuggestions] = useState<Suggestions>({ status: "idle" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetOpenRef = useRef(sheetOpen);
  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
  }, [sheetOpen]);

  useEffect(() => {
    if (!uid) return;
    return subscribeRecipes(uid, (list) => setRecipes({ list, loading: false }));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeShopping(uid, (list, fromServer) =>
      setShopping((s) => ({ list, loading: false, synced: s.synced || fromServer })),
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribePlans(uid, from, to, (list, fromServer) =>
      setUpcoming((s) => ({ list, synced: s.synced || fromServer })),
    );
  }, [uid, from, to]);

  // Missing ingredients of planned meals roll into the shopping list. Waits for
  // server data so a cold offline cache can't make the list look empty.
  useEffect(() => {
    if (!uid || inventoryLoading || !shopping.synced || !upcoming.synced) return;
    syncShopping(uid, neededFromPlans(upcoming.list, items, from), shopping.list);
  }, [uid, inventoryLoading, items, upcoming, shopping, from]);

  const requestSuggestions = useCallback(
    (preferences: string) => {
      const inventory: SuggestInventoryItem[] = [...items]
        .sort(compareByExpiry)
        .slice(0, 150)
        .map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          category: i.category,
          daysLeft: i.expiresAt ? daysUntil(i.expiresAt, today) : null,
        }));

      setSuggestions({ status: "loading", preferences });
      (async () => {
        try {
          const res = await apiFetch("/api/suggest-meals", {
            method: "POST",
            body: JSON.stringify({ inventory, preferences: preferences.trim() || undefined }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error ?? "Couldn't get meal ideas");
          setSuggestions({ status: "done", preferences, meals: body.meals as MealSuggestion[] });
          // Let the user keep navigating; call them back when ideas are ready.
          if (!sheetOpenRef.current) {
            toast("Meal ideas are ready", { action: { label: "View", onClick: () => setSheetOpen(true) } });
          }
        } catch (err) {
          const error = navigator.onLine ? (err as Error).message : "You're offline. Try again when you're connected.";
          setSuggestions({ status: "error", preferences, error });
        }
      })();
    },
    [items, today],
  );

  const value = useMemo<MealsState>(
    () => ({
      recipes: recipes.list,
      recipesLoading: recipes.loading,
      shopping: shopping.list,
      shoppingLoading: shopping.loading,
      upcoming: upcoming.list,
      suggestions,
      requestSuggestions,
      openSuggestions: () => setSheetOpen(true),
    }),
    [recipes, shopping, upcoming, suggestions, requestSuggestions],
  );

  return (
    <MealsContext.Provider value={value}>
      {children}
      <SuggestSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </MealsContext.Provider>
  );
}

export function useMeals(): MealsState {
  const ctx = useContext(MealsContext);
  if (!ctx) throw new Error("useMeals must be used inside <MealsProvider>");
  return ctx;
}
