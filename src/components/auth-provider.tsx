"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth(), (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  async function signIn() {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth(), provider);
    } catch (err) {
      // Popups are often blocked in installed PWAs; fall back to a full redirect.
      const code = (err as { code?: string }).code;
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth(), provider);
      } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        throw err;
      }
    }
  }

  async function signOut() {
    await fbSignOut(auth());
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
