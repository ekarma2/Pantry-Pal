"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { MealSheet, type SlotTarget } from "@/components/meals/meal-sheet";
import { useMeals } from "@/components/meals/meals-provider";
import { Button } from "@/components/ui/button";
import { useToday } from "@/hooks/use-today";
import { addDays } from "@/lib/dates";
import { subscribePlans } from "@/lib/meals-client";
import { dateKey, MEAL_SLOTS, SLOT_LABEL, weekDays, weekStart, type DayPlan, type MealSlot } from "@/lib/meals";
import { cn } from "@/lib/utils";

export default function PlanPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const today = useToday();
  const { suggestions, openSuggestions } = useMeals();
  const [offset, setOffset] = useState(0); // weeks from this week
  const [plans, setPlans] = useState<{ key: string; list: DayPlan[] } | null>(null);
  const [selected, setSelected] = useState<{ date: string; slot: MealSlot } | null>(null);

  const start = addDays(weekStart(today), offset * 7);
  const days = weekDays(start);
  const from = dateKey(days[0]);
  const to = dateKey(days[6]);
  const weekKey = `${from}_${to}`;

  useEffect(() => {
    if (!uid) return;
    return subscribePlans(uid, from, to, (list) => setPlans({ key: weekKey, list }));
  }, [uid, from, to, weekKey]);

  const weekPlans = useMemo(() => (plans?.key === weekKey ? plans.list : null), [plans, weekKey]);

  // Live meal for the open slot, so edits made elsewhere show up in the sheet.
  const target = useMemo<SlotTarget | null>(
    () =>
      selected && {
        ...selected,
        meal: weekPlans?.find((p) => p.date === selected.date)?.slots[selected.slot] ?? null,
      },
    [selected, weekPlans],
  );

  const range = `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  const todayKey = dateKey(today);

  return (
    <div className="space-y-4">
      <Button size="touch-lg" className="w-full" onClick={openSuggestions}>
        <Sparkles /> {suggestions.status === "loading" ? "Finding meal ideas…" : "What should I cook?"}
      </Button>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-touch" aria-label="Previous week" onClick={() => setOffset((o) => o - 1)}>
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <p className="font-medium" aria-live="polite">
            {range}
          </p>
          {offset !== 0 && (
            <button type="button" className="min-h-11 px-2 text-xs text-primary underline" onClick={() => setOffset(0)}>
              Back to this week
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon-touch" aria-label="Next week" onClick={() => setOffset((o) => o + 1)}>
          <ChevronRight />
        </Button>
      </div>

      <div className="space-y-4">
        {days.map((day) => {
          const key = dateKey(day);
          const plan = weekPlans?.find((p) => p.date === key);
          const isToday = key === todayKey;
          const past = key < todayKey;
          return (
            <section key={key} aria-labelledby={`day-${key}`} className={cn("space-y-2", past && "opacity-70")}>
              <h2 id={`day-${key}`} className="flex items-center gap-2 text-sm font-semibold">
                {day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                {isToday && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Today
                  </span>
                )}
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEAL_SLOTS.map((slot) => {
                  const meal = plan?.slots[slot];
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={!weekPlans}
                      onClick={() => setSelected({ date: key, slot })}
                      aria-label={`${SLOT_LABEL[slot]}: ${meal ? meal.title : "add a meal"}${meal?.cooked ? " (cooked)" : ""}`}
                      className={cn(
                        "flex min-h-16 flex-col items-start justify-between gap-1 rounded-xl border p-2.5 text-left",
                        meal ? "bg-card" : "border-dashed text-muted-foreground",
                        !weekPlans && "animate-pulse",
                      )}
                    >
                      <span className="text-xs text-muted-foreground">{SLOT_LABEL[slot]}</span>
                      {meal ? (
                        <span className={cn("line-clamp-2 text-sm font-medium", meal.cooked && "text-muted-foreground")}>
                          {meal.cooked && <Check aria-hidden className="mr-1 inline size-3.5 text-primary" />}
                          {meal.title}
                        </span>
                      ) : (
                        <Plus aria-hidden className="size-4" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <MealSheet target={target} onClose={() => setSelected(null)} />
    </div>
  );
}
