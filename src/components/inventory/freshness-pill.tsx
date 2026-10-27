import { cn } from "@/lib/utils";
import type { Freshness, Tone } from "@/lib/freshness";

const TONE: Record<Tone, string> = {
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  neutral: "bg-muted text-muted-foreground",
};

const DOT: Record<Tone, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  neutral: "bg-muted-foreground/50",
};

/** Color plus a text label, so freshness never relies on color alone. */
export function FreshnessPill({
  freshness,
  estimated = false,
  className,
}: {
  freshness: Freshness;
  /** Date came from the shelf-life table or AI rather than the package/user. */
  estimated?: boolean;
  className?: string;
}) {
  const showEstimate = estimated && freshness.days !== null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[freshness.tone],
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT[freshness.tone])} />
      {showEstimate && <span aria-hidden>~</span>}
      {freshness.label}
      {showEstimate && <span className="sr-only"> (estimated)</span>}
    </span>
  );
}
