import { getStorageItem, setStorageItem } from "@shared/services/sqliteStorage"

export const APP_MODE_KEY = "appMode"
export type AppMode = "online" | "offline"

let cachedMode: AppMode | null = null
let loadPromise: Promise<AppMode> | null = null

export const getAppMode = async (): Promise<AppMode> => {
  if (cachedMode) return cachedMode
  if (!loadPromise) {
    loadPromise = getStorageItem(APP_MODE_KEY).then((stored) => {
      cachedMode = (stored as AppMode) || "online"
      return cachedMode
    })
  }
  return loadPromise
}

export const setAppMode = async (mode: AppMode): Promise<boolean> => {
  await setStorageItem(APP_MODE_KEY, mode)
  cachedMode = mode
  onAppModeChange.trigger(mode)
  return true
}

export const isServerless = async (): Promise<boolean> => {
  return (await getAppMode()) === "offline"
}

// ponytail: inline pub/sub, no abstraction needed for one event
const modeListeners: ((v: AppMode) => void)[] = []
export const onAppModeChange = {
  subscribe: (fn: (v: AppMode) => void) => {
    modeListeners.push(fn)
    return () => { modeListeners.splice(modeListeners.indexOf(fn), 1) }
  },
  trigger: (v: AppMode) => modeListeners.forEach(fn => fn(v)),
}
