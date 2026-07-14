import AsyncStorage from "@react-native-async-storage/async-storage"

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

let currentMode: AppMode = DEFAULT_MODE
let loaded = false

const modeChangeListeners: Array<(mode: AppMode) => void> = []

const notifyModeChange = (mode: AppMode): void => {
  modeChangeListeners.forEach((listener) => listener(mode))
}

const initializeAppMode = async (): Promise<void> => {
  try {
    const savedMode = await AsyncStorage.getItem(MODE_STORAGE_KEY)
    if (savedMode === "on" || savedMode === "off") {
      currentMode = savedMode
    }
  } catch (error) {
    console.error("Error loading app mode:", error)
  } finally {
    loaded = true
  }
}

// Kick off loading immediately on module import, same as config.tsx does
// for the server URL.
const initPromise: Promise<void> = initializeAppMode()

/**
 * Await this once during app bootstrap (e.g. your root App component)
 * before the very first screen relies on getAppMode()/isServerless().
 * Every screen that reads the mode after that can use the sync getters.
 */
export const ensureAppModeLoaded = async (): Promise<void> => {
  if (!loaded) await initPromise
}

/** Synchronous read of the current mode. Defaults to "on" until loaded. */
export const getAppMode = (): AppMode => currentMode

export const isServerless = (): boolean => currentMode === "off"

/**
 * Switch modes. This only flips the flag + persists it + notifies
 * listeners — it does NOT migrate data between "on" and "off" storage.
 * Wire this up to a confirmation dialog in Settings ("Switching modes
 * won't move your existing data") before calling it.
 */
export const setAppMode = async (mode: AppMode): Promise<boolean> => {
  try {
    const previousMode = currentMode
    await AsyncStorage.setItem(MODE_STORAGE_KEY, mode)
    currentMode = mode
    if (previousMode !== mode) notifyModeChange(mode)
    return true
  } catch (error) {
    console.error("Error saving app mode:", error)
    return false
  }
}

/**
 * Subscribe to mode changes (e.g. to redirect the user, reset navigation
 * state, or refetch data when they flip the switch). Returns an
 * unsubscribe function.
 */
export const onAppModeChange = (
  callback: (mode: AppMode) => void,
): (() => void) => {
  modeChangeListeners.push(callback)
  return () => {
    const index = modeChangeListeners.indexOf(callback)
    if (index > -1) modeChangeListeners.splice(index, 1)
  }
}
