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

export interface ServerUrlValidation {
  valid: boolean
  message?: string
}

// RFC 1918 / loopback ranges, matched against the parsed hostname (not a substring of the URL).
export const isPrivateHost = (hostname: string): boolean => {
  if (hostname === "localhost" || hostname === "::1") return true
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/)
  if (!match) return false
  const a = Number(match[1])
  const b = Number(match[2])
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

export const validateServerUrl = (url: string): ServerUrlValidation => {
  const trimmedUrl = url.trim()

  if (!trimmedUrl) {
    return { valid: false, message: "Please enter a server URL" }
  }

  if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
    return { valid: false, message: "URL must start with http:// or https://" }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmedUrl)
  } catch {
    return { valid: false, message: "Invalid URL format" }
  }

  if (trimmedUrl.startsWith("http://") && !isPrivateHost(parsed.hostname)) {
    return {
      valid: false,
      message: "HTTP is not secure. Please use HTTPS for production servers.",
    }
  }

  return { valid: true }
}

export const setServerUrl = async (url: string): Promise<boolean> => {
  const trimmedUrl = url.trim()
  if (!validateServerUrl(trimmedUrl).valid) return false

  try {
    const previous = currentServerUrl
    await setStorageItem(SERVER_URL_KEY, trimmedUrl)
    currentServerUrl = trimmedUrl
    if (previous !== trimmedUrl) listeners.forEach((cb) => cb(trimmedUrl))
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
