"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/components/inventory/item-form";
import { useSettings } from "@/components/settings-provider";
import { apiFetch } from "@/lib/api";
import { formatHour, NOTIFY_HOURS, WARN_DAY_OPTIONS } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { InstallSteps } from "./push-prompt";
import { usePush } from "./use-push";

const warnLabel = (n: number) => (n === 0 ? "On the day" : n === 1 ? "1 day before" : `${n} days before`);

export function NotificationSettings() {
  const { settings, update } = useSettings();
  const push = usePush();
  const [testing, setTesting] = useState(false);

  const notifyHour = Number(settings.notifyTime.slice(0, 2));
  const hours = NOTIFY_HOURS.includes(notifyHour) ? NOTIFY_HOURS : [...NOTIFY_HOURS, notifyHour].sort((a, b) => a - b);

  async function sendTest() {
    setTesting(true);
    try {
      const res = await apiFetch("/api/push/test", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't send a test notification");
      toast.success("Sent. It should arrive in a few seconds.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <section aria-labelledby="alerts-heading" className="space-y-4">
      <h2 id="alerts-heading" className="font-semibold">
        Use-it-up alerts
      </h2>

      {push.support === "needs-install" ? (
        <div className="space-y-2 rounded-xl border p-4">
          <p className="text-sm">To get a daily notification on iPhone, add Pantry Pal to your Home Screen:</p>
          <InstallSteps />
        </div>
      ) : push.support === "unsupported" ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          This browser can&apos;t show notifications. You&apos;ll still see expiring food at the top of your Pantry.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <Label htmlFor="push-toggle" className="text-base font-normal">
              Daily notification
            </Label>
            <button
              id="push-toggle"
              type="button"
              role="switch"
              aria-checked={push.onThisDevice}
              disabled={push.busy || push.checking}
              onClick={() => (push.onThisDevice ? push.disable() : push.enable())}
              className="relative flex h-11 w-16 shrink-0 items-center justify-center disabled:opacity-50"
            >
              <span
                aria-hidden
                className={cn(
                  "h-7 w-12 rounded-full transition-colors",
                  push.onThisDevice ? "bg-primary" : "bg-muted-foreground/30",
                )}
              />
              <span
                aria-hidden
                className={cn(
                  "absolute left-2.5 size-6 rounded-full bg-white shadow transition-transform",
                  push.onThisDevice && "translate-x-5",
                )}
              />
            </button>
          </div>
          {push.permission === "denied" && !push.onThisDevice && (
            <p className="text-sm text-muted-foreground">
              Notifications are blocked for this app. Allow them in your browser or phone settings, then try again.
            </p>
          )}
          {push.elsewhere && (
            <p className="text-sm text-muted-foreground">
              Alerts currently go to another device. Turning them on here moves them to this one.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="notify-time">Time</Label>
          <select
            id="notify-time"
            className={selectClass}
            value={notifyHour}
            onChange={(e) => update({ notifyTime: `${e.target.value.padStart(2, "0")}:00` })}
          >
            {hours.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="warn-days">Warn me</Label>
          <select
            id="warn-days"
            className={selectClass}
            value={settings.warnDaysBefore}
            onChange={(e) => update({ warnDaysBefore: Number(e.target.value) })}
          >
            {WARN_DAY_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {warnLabel(n)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        “Warn me” also sets what shows in the Pantry banner. Times are in {settings.timezone.replace(/_/g, " ")}.
      </p>

      {push.onThisDevice && (
        <Button variant="outline" className="h-11 w-full" disabled={testing} onClick={sendTest}>
          {testing ? "Sending…" : "Send a test notification"}
        </Button>
      )}
    </section>
  );
}
