import { getStorageItem, setStorageItem, removeStorageItem } from "@shared/services/sqliteStorage"
import { getAppMode } from "@shared/services/appMode"

const SERVER_URL_KEY = "@server_url"
const DEFAULT_API_BASE_URL = "https://ownlift.superak0s.com"

let currentServerUrl = DEFAULT_API_BASE_URL

// ponytail: inline pub/sub, no abstraction needed for one event
const listeners: ((v: string) => void)[] = []
export const onServerUrlChange = (callback: (v: string) => void): (() => void) => {
  listeners.push(callback)
  return () => {
    const idx = listeners.indexOf(callback)
    if (idx > -1) listeners.splice(idx, 1)
  }
}

getAppMode()
  .then((mode) => {
    if (mode === "offline") return null
    return getStorageItem(SERVER_URL_KEY)
  })
  .then((raw) => {
    if (raw) currentServerUrl = raw
  })
  .catch((err) => console.error(`Error loading ${SERVER_URL_KEY}:`, err))

export const getServerUrl = (): string => currentServerUrl

export const setServerUrl = async (url: string): Promise<boolean> => {
  try {
    const previous = currentServerUrl
    await setStorageItem(SERVER_URL_KEY, url)
    currentServerUrl = url
    if (previous !== url) listeners.forEach((cb) => cb(url))
    return true
  } catch (err) {
    console.error(`Error saving ${SERVER_URL_KEY}:`, err)
    return false
  }
}

export const getDefaultServerUrl = (): string => DEFAULT_API_BASE_URL

export const resetServerUrl = async (): Promise<boolean> => {
  try {
    const previous = currentServerUrl
    await removeStorageItem(SERVER_URL_KEY)
    currentServerUrl = DEFAULT_API_BASE_URL
    if (previous !== DEFAULT_API_BASE_URL) listeners.forEach((cb) => cb(DEFAULT_API_BASE_URL))
    return true
  } catch (err) {
    console.error(`Error resetting ${SERVER_URL_KEY}:`, err)
    return false
  }
}
