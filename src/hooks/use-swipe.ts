"use client";

import { useRef, useState } from "react";

const INTERACTIVE = "input, select, textarea, button:not([data-swipe-surface]), a";

type Options = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
};

/**
 * Horizontal swipe on a row, leaving vertical scrolling alone. Pair the
 * returned handlers with `touch-action: pan-y` on the element.
 * Gestures that start on form controls are ignored.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 96 }: Options) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const swiped = useRef(false);

  function reset() {
    start.current = null;
    axis.current = null;
    setDragging(false);
    setDx(0);
  }

  const handlers = {
    onPointerDown(e: React.PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if ((e.target as Element).closest(INTERACTIVE)) return;
      start.current = { x: e.clientX, y: e.clientY };
      axis.current = null;
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      if (!start.current) return;
      const mx = e.clientX - start.current.x;
      const my = e.clientY - start.current.y;
      if (!axis.current) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        axis.current = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        if (axis.current === "x") {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }
      }
      if (axis.current === "x") {
        // Resist in directions with no action.
        const allowed = (mx > 0 && onSwipeRight) || (mx < 0 && onSwipeLeft);
        setDx(allowed ? mx : mx / 4);
      }
    },
    onPointerUp() {
      if (axis.current === "x") {
        swiped.current = true;
        if (dx > threshold) onSwipeRight?.();
        else if (dx < -threshold) onSwipeLeft?.();
      }
      reset();
    },
    onPointerCancel: reset,
  };

  /** Call from onClick: returns true if this click ended a swipe and should be ignored. */
  function consumeSwipeClick() {
    const was = swiped.current;
    swiped.current = false;
    return was;
  }

  return { dx, dragging, past: Math.abs(dx) > threshold, handlers, consumeSwipeClick };
}
