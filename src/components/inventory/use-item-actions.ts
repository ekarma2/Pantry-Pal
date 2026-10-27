"use client";

import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useToday } from "@/hooks/use-today";
import { withTableExpiry } from "@/lib/expiry";
import * as inv from "@/lib/inventory";
import { COUNT_UNITS, type InventoryItem, type NewItem, type WasteReason } from "@/lib/types";

/** The amount a single "used it" removes: one of a countable item, otherwise all of it. */
export function defaultUseAmount(item: InventoryItem): number {
  const countable = COUNT_UNITS.has(item.unit) && Number.isInteger(item.quantity);
  return countable && item.quantity > 1 ? 1 : item.quantity;
}

function withUndo(message: string, undo: () => void) {
  toast(message, { action: { label: "Undo", onClick: undo } });
}

/** Inventory mutations wired to undo toasts. */
export function useItemActions() {
  const { user } = useAuth();
  const today = useToday();
  const uid = user?.uid ?? "";

  return {
    /** Items without a date get one from the shelf-life table now, or from Claude via the backfill. */
    add(items: NewItem[]) {
      const now = new Date();
      const ids = inv.addItems(uid, items.map((i) => withTableExpiry(i, now)));
      const label = items.length === 1 ? `Added ${items[0].name}` : `Added ${items.length} items`;
      withUndo(label, () => inv.deleteItemsById(uid, ids));
    },

    update(item: InventoryItem, patch: NewItem) {
      // Re-estimate when the date was cleared, or when it was an estimate and
      // something it was based on changed.
      const estimated = patch.expirySource === "table" || patch.expirySource === "ai";
      const basisChanged =
        patch.name !== item.name || patch.category !== item.category || patch.location !== item.location;
      const next = !patch.expiresAt || (estimated && basisChanged)
        ? withTableExpiry({ ...patch, expiresAt: null }, item.addedAt)
        : patch;
      inv.updateItem(uid, item.id, next);
      toast.success("Saved");
    },

    used(item: InventoryItem, amount = defaultUseAmount(item)) {
      const undo = inv.markUsed(uid, item, amount);
      const left = item.quantity - amount;
      withUndo(left > 0 ? `Used ${amount} ${item.name} · ${left} left` : `Used up ${item.name}`, undo);
    },

    wasted(item: InventoryItem, reason: WasteReason | null = null) {
      withUndo(`Threw out ${item.name}`, inv.markWasted(uid, item, reason));
    },

    freeze(item: InventoryItem) {
      withUndo(`Moved ${item.name} to freezer`, inv.moveToFreezer(uid, item, today));
    },

    remove(item: InventoryItem) {
      withUndo(`Removed ${item.name}`, inv.deleteItem(uid, item));
    },
  };
}
