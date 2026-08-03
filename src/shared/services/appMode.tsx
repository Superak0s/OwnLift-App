import { createManagedState } from "./managedState"

/**
 * App Mode
 * ────────
 * "on"  -> talk to the server (existing services/on/* implementations)
 * "off" -> fully serverless, everything lives in AsyncStorage/local files
 *          (services/off/* implementations)
 *
 * This is the single source of truth that services/api.tsx reads from to
 * decide which implementation to re-export. Flip it from a settings screen
 * or the login screen with setAppMode("off") / setAppMode("on").
 */

export type AppMode = "on" | "off"

const MODE_STORAGE_KEY = "@app_mode"
const DEFAULT_MODE: AppMode = "on"

const appModeState = createManagedState<AppMode>(MODE_STORAGE_KEY, DEFAULT_MODE, {
  validate: (raw) => (raw === "on" || raw === "off" ? raw : null),
})

// Kick off loading immediately on module import, same as config.tsx does
// for the server URL.
appModeState.ensureLoaded()

/**
 * Await this once during app bootstrap (e.g. your root App component)
 * before the very first screen relies on getAppMode()/isServerless().
 * Every screen that reads the mode after that can use the sync getters.
 */
export const ensureAppModeLoaded = appModeState.ensureLoaded

/** Synchronous read of the current mode. Defaults to "on" until loaded. */
export const getAppMode = (): AppMode => appModeState.get()

export const isServerless = (): boolean => appModeState.get() === "off"

/**
 * Switch modes. This only flips the flag + persists it + notifies
 * listeners — it does NOT migrate data between "on" and "off" storage.
 * Wire this up to a confirmation dialog in Settings ("Switching modes
 * won't move your existing data") before calling it.
 */
export const setAppMode = appModeState.set

/**
 * Subscribe to mode changes (e.g. to redirect the user, reset navigation
 * state, or refetch data when they flip the switch). Returns an
 * unsubscribe function.
 */
export const onAppModeChange = appModeState.onChange
