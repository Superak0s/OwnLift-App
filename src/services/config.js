import AsyncStorage from "@react-native-async-storage/async-storage"

// Default server URL
const DEFAULT_API_BASE_URL = "http://192.168.10.243:3000"

// Get the current server URL
let API_BASE_URL = DEFAULT_API_BASE_URL

// Server change listeners
const serverChangeListeners = []

// Register a listener for server URL changes
export const onServerUrlChange = (callback) => {
  serverChangeListeners.push(callback)
  // Return unsubscribe function
  return () => {
    const index = serverChangeListeners.indexOf(callback)
    if (index > -1) {
      serverChangeListeners.splice(index, 1)
    }
  }
}

// Notify all listeners when server URL changes
const notifyServerChange = (newUrl) => {
  serverChangeListeners.forEach((listener) => listener(newUrl))
}

// Initialize API URL from storage
const initializeApiUrl = async () => {
  try {
    const savedUrl = await AsyncStorage.getItem("@server_url")
    if (savedUrl) {
      API_BASE_URL = savedUrl
    }
  } catch (error) {
    console.error("Error loading server URL:", error)
  }
}

// Set server URL
export const setServerUrl = async (url) => {
  try {
    const previousUrl = API_BASE_URL
    await AsyncStorage.setItem("@server_url", url)
    API_BASE_URL = url

    // Notify listeners if URL actually changed
    if (previousUrl !== url) {
      notifyServerChange(url)
    }

    return true
  } catch (error) {
    console.error("Error saving server URL:", error)
    return false
  }
}

// Get current server URL
export const getServerUrl = () => API_BASE_URL

// Get default server URL
export const getDefaultServerUrl = () => DEFAULT_API_BASE_URL

// Reset to default server URL
export const resetServerUrl = async () => {
  try {
    const previousUrl = API_BASE_URL
    await AsyncStorage.removeItem("@server_url")
    API_BASE_URL = DEFAULT_API_BASE_URL

    // Notify listeners if URL actually changed
    if (previousUrl !== DEFAULT_API_BASE_URL) {
      notifyServerChange(DEFAULT_API_BASE_URL)
    }

    return true
  } catch (error) {
    console.error("Error resetting server URL:", error)
    return false
  }
}

// Initialize on module load
initializeApiUrl()
