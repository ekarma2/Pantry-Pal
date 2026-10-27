"use client";

import { useEffect, useRef } from "react";
import { useOnline } from "@/hooks/use-online";
import { addDays, startOfDay } from "@/lib/dates";
import { aiShelfLifeDays } from "@/lib/expiry";
import { setAiExpiry } from "@/lib/inventory";
import type { InventoryItem } from "@/lib/types";

/**
 * Asks Claude for an expiry for any item the shelf-life table couldn't date.
 * Runs whenever we're online, so items added offline get dated on reconnect.
 */
export function useExpiryBackfill(uid: string | undefined, items: InventoryItem[]) {
  const online = useOnline();
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    if (!uid || !online) return;
    // Key on the fields that affect the estimate, so an edit triggers a fresh attempt.
    const keyOf = (i: InventoryItem) => `${i.id}|${i.name}|${i.category}|${i.location}`;
    const pending = items.filter((i) => !i.expiresAt && !attempted.current.has(keyOf(i)));
    if (pending.length === 0) return;
    pending.forEach((i) => attempted.current.add(keyOf(i)));

    (async () => {
      for (const item of pending) {
        const days = await aiShelfLifeDays(item);
        if (days != null) setAiExpiry(uid, item.id, addDays(startOfDay(item.addedAt), days));
        else attempted.current.delete(keyOf(item)); // retry on a later change / reconnect
      }
    })();
  }, [uid, online, items]);
}
