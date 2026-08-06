import AsyncStorage from "@react-native-async-storage/async-storage"

export const APP_MODE_KEY = "appMode"
export type AppMode = "online" | "offline"

export const getAppMode = async (): Promise<AppMode> => {
  const stored = await AsyncStorage.getItem(APP_MODE_KEY)
  return (stored as AppMode) || "online"
}

export const setAppMode = async (mode: AppMode): Promise<boolean> => {
  await AsyncStorage.setItem(APP_MODE_KEY, mode)
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
