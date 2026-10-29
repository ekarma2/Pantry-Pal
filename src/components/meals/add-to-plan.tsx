"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { selectClass } from "@/components/inventory/item-form";
import { Button } from "@/components/ui/button";
import { useToday } from "@/hooks/use-today";
import { addDays } from "@/lib/dates";
import { removeMeal, setMeal } from "@/lib/meals-client";
import { dateKey, MEAL_SLOTS, nextOpenSlot, SLOT_LABEL, type Meal, type MealSlot } from "@/lib/meals";
import { useMeals } from "./meals-provider";

export function dayLabel(date: Date, today: Date): string {
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Day + slot picker that puts `meal` into the planner (with undo). */
export function AddToPlan({ meal, onAdded }: { meal: Meal; onAdded?: () => void }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { upcoming } = useMeals();
  const today = useToday();
  const [initial] = useState(() => nextOpenSlot(upcoming, today));
  const [date, setDate] = useState(initial.date);
  const [slot, setSlot] = useState<MealSlot>(initial.slot);

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const existing = upcoming.find((p) => p.date === date)?.slots[slot];

  function add() {
    setMeal(uid, date, slot, { ...meal, cooked: false });
    const day = days.find((d) => dateKey(d) === date);
    toast(`Added to ${day ? dayLabel(day, today) : date} · ${SLOT_LABEL[slot]}`, {
      action: {
        label: "Undo",
        onClick: () => (existing ? setMeal(uid, date, slot, existing) : removeMeal(uid, date, slot, meal)),
      },
    });
    onAdded?.();
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Day" className={selectClass} value={date} onChange={(e) => setDate(e.target.value)}>
          {days.map((d) => (
            <option key={dateKey(d)} value={dateKey(d)}>
              {dayLabel(d, today)}
            </option>
          ))}
        </select>
        <select
          aria-label="Meal"
          className={selectClass}
          value={slot}
          onChange={(e) => setSlot(e.target.value as MealSlot)}
        >
          {MEAL_SLOTS.map((s) => (
            <option key={s} value={s}>
              {SLOT_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      {existing && <p className="text-xs text-muted-foreground">Replaces “{existing.title}”.</p>}
      <Button size="touch" className="w-full" onClick={add}>
        <CalendarPlus /> Add to plan
      </Button>
    </div>
  );
}
