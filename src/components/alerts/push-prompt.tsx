"use client";

import { useState } from "react";
import { Bell, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/components/settings-provider";
import { formatHour } from "@/lib/settings";
import { usePush } from "./use-push";

const DISMISS_KEY = "pantrypal.pushPromptDismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Shows how to add the app to the iPhone Home Screen (push needs it). */
export function InstallSteps() {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
      <li>
        In Safari, tap <Share aria-label="Share" className="inline size-4 align-text-bottom" /> Share.
      </li>
      <li>Choose “Add to Home Screen”.</li>
      <li>Open Pantry Pal from your Home Screen and turn on alerts in Settings.</li>
    </ol>
  );
}

/**
 * One-time Home card: offers the daily alert, or on iPhone explains that alerts
 * need the Home Screen app. Never blocks the app; the banner works either way.
 */
export function PushPrompt() {
  const { settings, loading } = useSettings();
  const push = usePush();
  const [dismissed, setDismissed] = useState(readDismissed);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode: it just shows again next time.
    }
  }

  if (dismissed || loading || push.checking || settings.pushSubscription) return null;
  const offer = push.support === "supported" && push.permission === "default";
  if (push.support !== "needs-install" && !offer) return null;

  return (
    <section aria-label="Daily alerts" className="relative space-y-2 rounded-xl border bg-card p-4 pr-12">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
      <p className="flex items-center gap-2 font-medium">
        <Bell aria-hidden className="size-4 text-primary" /> Get a daily heads-up
      </p>
      {push.support === "needs-install" ? (
        <>
          <p className="text-sm text-muted-foreground">
            On iPhone, notifications only work after you add Pantry Pal to your Home Screen:
          </p>
          <InstallSteps />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            We&apos;ll send one notification at {formatHour(Number(settings.notifyTime.slice(0, 2)))} listing food
            that&apos;s about to expire. You can change the time in Settings.
          </p>
          <div className="flex gap-2 pt-1">
            <Button size="touch" disabled={push.busy} onClick={() => push.enable().then((ok) => ok && dismiss())}>
              Turn on
            </Button>
            <Button size="touch" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
