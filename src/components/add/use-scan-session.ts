"use client";

import { useRef, useState } from "react";
import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";
import { lookupBarcode, type LookupResult } from "@/lib/barcode-client";
import type { ParsedItem } from "@/lib/types";

export type Scan = { code: string; qty: number; result: LookupResult | null };

// Holding the camera on one product keeps detecting it; only count it again
// after it has been out of view this long (e.g. scanning a second identical can).
const REPEAT_AFTER_MS = 2500;

/** Pending list for multi-scan: scan many items, look each up once, review together. */
export function useScanSession(uid: string | undefined) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [lastScanned, setLastScanned] = useState<{ code: string; at: number } | null>(null);
  const lastSeen = useRef(new Map<string, number>());
  const lookups = useRef(new Map<string, Promise<LookupResult>>());

  function add(raw: string) {
    const code = normalizeBarcode(raw);
    if (!uid || !isValidBarcode(code)) return;

    const now = Date.now();
    const seen = lastSeen.current.get(code);
    lastSeen.current.set(code, now);
    if (seen && now - seen < REPEAT_AFTER_MS) return;

    navigator.vibrate?.(60);
    setLastScanned({ code, at: now });

    if (lookups.current.has(code)) {
      setScans((ss) => ss.map((s) => (s.code === code ? { ...s, qty: s.qty + 1 } : s)));
      return;
    }

    const lookup = lookupBarcode(uid, code);
    lookups.current.set(code, lookup);
    setScans((ss) => [{ code, qty: 1, result: null }, ...ss]);
    lookup.then((result) => setScans((ss) => ss.map((s) => (s.code === code ? { ...s, result } : s))));
  }

  function remove(code: string) {
    lookups.current.delete(code);
    lastSeen.current.delete(code);
    setScans((ss) => ss.filter((s) => s.code !== code));
  }

  /** Hand the pending list off to Review & Confirm and start a fresh session. */
  function takeAll(): () => Promise<ParsedItem[]> {
    const taken = [...scans].reverse(); // scan order
    const pending = new Map(lookups.current);
    setScans([]);
    setLastScanned(null);
    lookups.current.clear();
    lastSeen.current.clear();

    return async () =>
      Promise.all(
        taken.map(async (s): Promise<ParsedItem> => {
          const result = s.result ?? (await pending.get(s.code)!);
          if (result.status === "found") return { ...result.product, quantity: s.qty };
          return {
            name: "",
            quantity: s.qty,
            unit: "item",
            category: "other",
            location: "pantry",
            estimatedShelfLifeDays: null,
            confidence: "low",
            barcode: s.code,
          };
        }),
      );
  }

  return { scans, lastScanned, add, remove, takeAll };
}
