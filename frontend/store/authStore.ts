/**
 * store/authStore.ts
 * ───────────────────
 * Zustand store managing authentication state for the entire application.
 *
 * Security design:
 *  - The JWT is stored in a module-level variable (JS memory) rather than
 *    localStorage or a cookie. This prevents XSS attacks from reading the
 *    token via `localStorage.getItem()`.
 *  - The token is also written to `window.__phishcatch_token` (the slot the
 *    axios interceptor in lib/api.ts reads) so it survives React re-renders
 *    without being exposed in React state or the DOM.
 *  - On logout, the token is wiped from both locations.
 *  - The user profile (email, username) is stored in Zustand state so UI
 *    components can read it without a network call.
 *
 * Trade-off: Storing the token in memory means it is lost on page refresh.
 * We handle this by attempting a silent `/api/auth/me` call on app mount
 * (using a persisted "session hint" cookie set by the backend – not
 * implemented here, but the `initialize` action is the hook point for it).
 * For simplicity in Phase 3, a page refresh requires re-login.
 */
import { create } from "zustand";
import { authApi, extractErrorMessage } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;   // true while login/register is in-flight

  // Actions
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

// Module-level token slot (not part of React/Zustand state to avoid leaking
// into React DevTools or serialised state snapshots).
let _token: string | null = null;

/** Write the token to the memory slot + window slot read by axios. */
function setToken(token: string | null): void {
  _token = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.__phishcatch_token = token;
    } else {
      delete window.__phishcatch_token;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  /**
   * Authenticate with email/username + password.
   * On success, stores the JWT and fetches the user profile.
   * Throws a plain Error with a user-readable message on failure.
   */
  login: async (identifier: string, password: string) => {
    set({ isLoading: true });
    try {
      const tokenResponse = await authApi.login(identifier, password);
      setToken(tokenResponse.access_token);

      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw new Error(extractErrorMessage(err));
    }
  },

  /**
   * Register a new account then immediately log in.
   * Throws a plain Error with a user-readable message on failure.
   */
  register: async (email: string, username: string, password: string) => {
    set({ isLoading: true });
    try {
      await authApi.register(email, username, password);
      // Auto-login after registration so the user lands on the dashboard
      const tokenResponse = await authApi.login(email, password);
      setToken(tokenResponse.access_token);

      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw new Error(extractErrorMessage(err));
    }
  },

  /** Clear all auth state and wipe the token from memory. */
  logout: () => {
    setToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Global logout event listener
// Fired by the axios interceptor in lib/api.ts when a 401 is received,
// meaning the token has expired or been revoked server-side.
// ─────────────────────────────────────────────────────────────────────────────
if (typeof window !== "undefined") {
  window.addEventListener("phishcatch:logout", () => {
    useAuthStore.getState().logout();
  });
}
