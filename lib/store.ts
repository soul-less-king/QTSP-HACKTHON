"use client";

import { create } from "zustand";
import type { SessionUser } from "./types";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  setUser: (user: SessionUser | null) => void;
  fetchUser: () => Promise<SessionUser | null>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  fetchUser: async () => {
    try {
      const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
      if (!res.ok) {
        set({ user: null, loading: false });
        return null;
      }
      const data = await res.json();
      const user: SessionUser = {
        id: data.id,
        email: data.email,
        role: data.role,
        fullName: data.full_name,
      };
      set({ user, loading: false });
      return user;
    } catch {
      set({ user: null, loading: false });
      return null;
    }
  },
  logout: async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    set({ user: null });
  },
}));
