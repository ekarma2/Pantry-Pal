"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { subscribeActiveItems } from "@/lib/inventory";
import type { InventoryItem } from "@/lib/types";
import { useExpiryBackfill } from "./use-expiry-backfill";

type InventoryState = { items: InventoryItem[]; loading: boolean };

const InventoryContext = createContext<InventoryState | null>(null);

/** One live subscription to the user's active items, shared by every screen. */
export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, setState] = useState<InventoryState>({ items: [], loading: true });

  useEffect(() => {
    if (!uid) return;
    return subscribeActiveItems(
      uid,
      (items) => setState({ items, loading: false }),
      (err) => {
        console.error(err);
        toast.error("Couldn't load your inventory.");
        setState((s) => ({ ...s, loading: false }));
      },
    );
  }, [uid]);

  useExpiryBackfill(uid, state.items);

  return <InventoryContext.Provider value={state}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryState {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside <InventoryProvider>");
  return ctx;
}
