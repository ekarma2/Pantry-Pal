"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { deleteField, doc, onSnapshot, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { firestore } from "@/lib/firebase/client";
import { DEFAULT_SETTINGS, SETTINGS_DOC_ID, settingsFromDoc, type Settings } from "@/lib/settings";

type SettingsPatch = Partial<Omit<Settings, "lastDigestDate" | "pushSubscription">> & {
  pushSubscription?: Settings["pushSubscription"];
};

type SettingsState = {
  settings: Settings;
  loading: boolean;
  update: (patch: SettingsPatch) => void;
};

const SettingsContext = createContext<SettingsState | null>(null);

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** Live users/{uid}/settings/main, shared by Home (banner) and Settings. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, setState] = useState({ settings: DEFAULT_SETTINGS, loading: true });

  const update = useCallback(
    (patch: SettingsPatch) => {
      if (!uid) return;
      const data: Record<string, unknown> = { ...patch };
      if (patch.pushSubscription === null) data.pushSubscription = deleteField();
      // Fire and forget: offline, the local cache updates now and syncs later.
      setDoc(doc(firestore(), "users", uid, "settings", SETTINGS_DOC_ID), data, { merge: true }).catch((err) => {
        console.error(err);
        toast.error("Couldn't save your settings. Please try again.");
      });
    },
    [uid],
  );

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(firestore(), "users", uid, "settings", SETTINGS_DOC_ID),
      (snap) => setState({ settings: settingsFromDoc(snap.data()), loading: false }),
      (err) => {
        console.error(err);
        setState((s) => ({ ...s, loading: false }));
      },
    );
  }, [uid]);

  // Keep the stored time zone matching this device so the digest arrives at local notifyTime.
  const { loading, settings } = state;
  useEffect(() => {
    if (loading) return;
    const tz = deviceTimeZone();
    if (settings.timezone !== tz) update({ timezone: tz });
  }, [loading, settings.timezone, update]);

  const value = useMemo(() => ({ ...state, update }), [state, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
