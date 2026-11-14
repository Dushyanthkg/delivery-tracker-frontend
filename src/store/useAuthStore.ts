'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthResponse, User } from '@/services/types';

/**
 * Session lives in localStorage and is sent as a Bearer header — never a
 * cookie — mirroring exactly how a native mobile client authenticates.
 */
interface AuthState {
  token: string | null;
  user: User | null;
  /** epoch ms */
  expiresAt: number | null;
  /** True once persisted state has been read on the client. */
  hydrated: boolean;
  /** Why the last logout happened — guards only add `?next=` for expiries. */
  logoutReason: 'user' | 'expired' | null;
  setSession: (auth: AuthResponse) => void;
  setUser: (user: User) => void;
  logout: (reason?: 'user' | 'expired') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      expiresAt: null,
      hydrated: false,
      logoutReason: null,
      setSession: ({ token, user, expiresIn }) =>
        set({ token, user, expiresAt: Date.now() + expiresIn * 1000, logoutReason: null }),
      setUser: (user) => set({ user }),
      logout: (reason = 'expired') => set({ token: null, user: null, expiresAt: null, logoutReason: reason }),
    }),
    {
      name: 'dt-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, user, expiresAt }) => ({ token, user, expiresAt }),
      // Rehydrate manually after mount so server HTML and first client render match.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state?.expiresAt && state.expiresAt < Date.now()) state.logout();
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);
