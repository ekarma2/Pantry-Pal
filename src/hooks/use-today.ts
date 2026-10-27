"use client";

import { useEffect, useState } from "react";
import { startOfDay } from "@/lib/dates";

/** Local midnight of today; refreshes when the app returns to the foreground on a new day. */
export function useToday(): Date {
  const [today, setToday] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    function refresh() {
      const now = startOfDay(new Date());
      setToday((prev) => (prev.getTime() === now.getTime() ? prev : now));
    }
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(timer);
    };
  }, []);

  return today;
}
