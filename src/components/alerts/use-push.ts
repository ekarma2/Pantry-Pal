"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSettings } from "@/components/settings-provider";
import { currentEndpoint, pushSupport, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";

/** Push state for this device, and on/off actions that keep Firestore in sync. */
export function usePush() {
  const { settings, update } = useSettings();
  const [support] = useState(pushSupport);
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined); // undefined = checking
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    currentEndpoint()
      .then(setEndpoint)
      .catch(() => setEndpoint(null));
  }, []);

  const stored = settings.pushSubscription?.endpoint ?? null;
  const onThisDevice = !!endpoint && endpoint === stored;
  const permission = support === "supported" ? Notification.permission : "default";

  async function enable(): Promise<boolean> {
    setBusy(true);
    try {
      const sub = await subscribeToPush();
      setEndpoint(sub.endpoint);
      update({ pushSubscription: sub });
      toast.success("Daily alerts are on");
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await unsubscribeFromPush();
    } catch (err) {
      console.error(err);
    } finally {
      setEndpoint(null);
      update({ pushSubscription: null });
      setBusy(false);
    }
  }

  return {
    support,
    permission,
    checking: endpoint === undefined,
    onThisDevice,
    /** Alerts go to a different phone/browser (only one device receives them). */
    elsewhere: !!stored && !onThisDevice,
    busy,
    enable,
    disable,
  };
}
