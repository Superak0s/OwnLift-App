// features/auth/services/off/auth.tsx

import AsyncStorage from "@react-native-async-storage/async-storage"
import { tokenStorage } from "@shared/services/tokenStorage"
import type { AuthResponse, AuthUser } from "../../types"

/**
 * Serverless Authentication Service
 * ─────────────────────────────────
 * There's no server to authenticate against, so "signup"/"signin" just
 * create-or-load a single local profile on-device. Passwords are accepted
 * as parameters purely so call sites written against services/on/auth.tsx
 * don't need to branch — they're never checked or stored.
 *
 * One local profile per device/app-install. If you need multiple local
 * profiles later, swap LOCAL_USER_KEY for something keyed by a chosen
 * profile name.
 *
 * The session token goes through shared/services/tokenStorage instead of
 * a local "@auth_token" constant, since both on/auth.tsx and this file
 * write the same AsyncStorage key — tokenStorage is the single owner of
 * it now.
 *
 * Note: this file used to export an `authenticatedFetch` stub that threw
 * if called offline. That's dropped — authenticatedFetch now lives only
 * in shared/services/authenticatedFetch.tsx, and callers should be
 * routed to this feature's own local methods instead of
 * authenticatedFetch entirely when running in offline mode (that's the
 * dispatch proxy's job, not something authenticatedFetch itself should
 * encode).
 */

const LOCAL_USER_KEY = "@offline_user"
const LOCAL_USER_ID = "local"

const generateLocalToken = (): string =>
  `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const authService = {
  /**
   * Creates the local profile (overwrites any existing one) and starts
   * a local "session".
   */
  signup: async (
    username: string,
    email: string,
    _password: string,
    name: string | null = null,
  ): Promise<AuthResponse> => {
    const user: AuthUser = {
      id: LOCAL_USER_ID,
      username,
      email,
      ...(name && { name }),
    }
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user))
    await tokenStorage.set(generateLocalToken())
    return { success: true, token: "offline", user }
  },

  /**
   * Loads the existing local profile if one exists, otherwise creates a
   * bare-bones one from the given username. Password is ignored — there's
   * nothing to check it against offline.
   */
  signin: async (
    username: string,
    _password: string,
  ): Promise<AuthResponse> => {
    const existing = await authService.getStoredUser()
    const user: AuthUser = existing || {
      id: LOCAL_USER_ID,
      username,
      email: "",
    }
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user))
    await tokenStorage.set(generateLocalToken())
    return { success: true, token: "offline", user }
  },

  getCurrentUser: async (): Promise<AuthUser> => {
    const user = await authService.getStoredUser()
    if (!user) throw new Error("No local profile found")
    return user
  },

  updateProfile: async (name: string, email: string): Promise<AuthUser> => {
    const existing = (await authService.getStoredUser()) || {
      id: LOCAL_USER_ID,
      username: "me",
      email: "",
    }
    const updated: AuthUser = { ...existing, name, email }
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updated))
    return updated
  },

  /** Nothing to change offline — kept for interface parity. */
  changePassword: async (): Promise<unknown> => {
    return { success: true }
  },

  getToken: async (): Promise<string | null> => {
    return await tokenStorage.get()
  },

  isAuthenticated: async (): Promise<boolean> => {
    return !!(await authService.getStoredUser())
  },

  /**
   * Clears the local "session" token only. Deliberately does NOT wipe the
   * local profile or any tracking data — "logging out" offline shouldn't
   * delete a user's workouts/macros/photos. Add an explicit "reset local
   * data" action elsewhere if you want a destructive option.
   */
  logout: async (): Promise<void> => {
    await tokenStorage.clear()
  },

  getStoredUser: async (): Promise<AuthUser | null> => {
    const userJson = await AsyncStorage.getItem(LOCAL_USER_KEY)
    return userJson ? (JSON.parse(userJson) as AuthUser) : null
  },
}
