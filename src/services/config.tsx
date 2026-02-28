import AsyncStorage from '@react-native-async-storage/async-storage'

// Default server URL
const DEFAULT_API_BASE_URL = 'http://192.168.10.243:3000'

// Get the current server URL
let API_BASE_URL = DEFAULT_API_BASE_URL

// Server change listeners
const serverChangeListeners: Array<(url: string) => void> = []

/**
 * Register a listener for server URL changes.
 * Returns an unsubscribe function.
 */
export const onServerUrlChange = (callback: (url: string) => void): (() => void) => {
  serverChangeListeners.push(callback)
  return () => {
    const index = serverChangeListeners.indexOf(callback)
    if (index > -1) serverChangeListeners.splice(index, 1)
  }
}

const notifyServerChange = (newUrl: string): void => {
  serverChangeListeners.forEach((listener) => listener(newUrl))
}

const initializeApiUrl = async (): Promise<void> => {
  try {
    const savedUrl = await AsyncStorage.getItem('@server_url')
    if (savedUrl) API_BASE_URL = savedUrl
  } catch (error) {
    console.error('Error loading server URL:', error)
  }
}

export const setServerUrl = async (url: string): Promise<boolean> => {
  try {
    const previousUrl = API_BASE_URL
    await AsyncStorage.setItem('@server_url', url)
    API_BASE_URL = url
    if (previousUrl !== url) notifyServerChange(url)
    return true
  } catch (error) {
    console.error('Error saving server URL:', error)
    return false
  }
}

export const getServerUrl = (): string => API_BASE_URL

export const getDefaultServerUrl = (): string => DEFAULT_API_BASE_URL

export const resetServerUrl = async (): Promise<boolean> => {
  try {
    const previousUrl = API_BASE_URL
    await AsyncStorage.removeItem('@server_url')
    API_BASE_URL = DEFAULT_API_BASE_URL
    if (previousUrl !== DEFAULT_API_BASE_URL) notifyServerChange(DEFAULT_API_BASE_URL)
    return true
  } catch (error) {
    console.error('Error resetting server URL:', error)
    return false
  }
}

// Initialize on module load
initializeApiUrl()
