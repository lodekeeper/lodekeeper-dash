import { create } from "zustand";
import { api } from "../api/client";

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  setupRequired: boolean;
  checkAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  setup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setupRequired: false,

  checkAuth: async () => {
    try {
      const status = await api.get<{ setupComplete: boolean; hasUsers: boolean }>("/api/auth/status");
      if (!status.setupComplete) {
        set({ loading: false, setupRequired: true });
        return;
      }

      const data = await api.get<{ user: User }>("/api/auth/me");
      set({ user: data.user, loading: false, setupRequired: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (username, password) => {
    const data = await api.post<{ user: User }>("/api/auth/login", { username, password });
    set({ user: data.user });
  },

  setup: async (username, password) => {
    const data = await api.post<{ user: User }>("/api/auth/setup", { username, password });
    set({ user: data.user, setupRequired: false });
  },

  logout: async () => {
    await api.post("/api/auth/logout");
    set({ user: null });
  },
}));
