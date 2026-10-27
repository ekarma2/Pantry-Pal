"use client";

import { Check, Trash2 } from "lucide-react";
import { useSwipe } from "@/hooks/use-swipe";
import { cn } from "@/lib/utils";
import type { Freshness } from "@/lib/freshness";
import type { InventoryItem } from "@/lib/types";
import { FreshnessPill } from "./freshness-pill";
import { LocationIcon } from "./location-icon";

type Props = {
  item: InventoryItem;
  freshness: Freshness;
  onOpen: () => void;
  onSwipeRight: () => void; // Used
  onSwipeLeft: () => void; // Threw out
};

/** List row: tap opens details, swipe right = used, swipe left = threw out. */
export function ItemRow({ item, freshness, onOpen, onSwipeRight, onSwipeLeft }: Props) {
  const { dx, dragging, past, handlers, consumeSwipeClick } = useSwipe({ onSwipeLeft, onSwipeRight });

  return (
    <li className="relative overflow-hidden rounded-xl">
      {/* Revealed behind the row while swiping. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center px-5 text-sm font-medium text-white transition-colors",
          dx > 0 ? "justify-start" : "justify-end",
          dx > 0 ? (past ? "bg-green-600" : "bg-green-600/60") : past ? "bg-red-600" : "bg-red-600/60",
          dx === 0 && "invisible",
        )}
      >
        {dx > 0 ? (
          <span className="flex items-center gap-2"><Check className="size-5" /> Used</span>
        ) : (
          <span className="flex items-center gap-2">Threw out <Trash2 className="size-5" /></span>
        )}
      </div>

      <button
        type="button"
        data-swipe-surface
        onClick={() => !consumeSwipeClick() && onOpen()}
        {...handlers}
        style={{ transform: `translateX(${dx}px)` }}
        className={cn(
          "relative flex min-h-16 w-full touch-pan-y items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left",
          !dragging && "transition-transform duration-200",
        )}
      >
        <LocationIcon location={item.location} className="size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.name}</span>
          <span className="block text-sm text-muted-foreground">
            {item.quantity} {item.unit}
          </span>
        </span>
        <FreshnessPill
          freshness={freshness}
          estimated={item.expirySource === "table" || item.expirySource === "ai"}
        />
      </button>
    </li>
  );
}
