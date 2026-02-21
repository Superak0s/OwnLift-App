import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * Storage Utilities
 * Handles all AsyncStorage operations with user-specific keys
 */

/**
 * Get user-specific storage key
 */
export const getUserKey = (key, userId) => {
  if (!userId) return key
  return `${key}_user_${userId}`
}

/**
 * Save data to AsyncStorage
 */
export const saveToStorage = async (key, value, userId = null) => {
  try {
    const storageKey = getUserKey(key, userId)
    const stringValue =
      typeof value === "string" ? value : JSON.stringify(value)
    await AsyncStorage.setItem(storageKey, stringValue)
    return true
  } catch (error) {
    console.error(`Error saving ${key}:`, error)
    return false
  }
}

/**
 * Load data from AsyncStorage
 */
export const loadFromStorage = async (key, userId = null, parse = true) => {
  try {
    const storageKey = getUserKey(key, userId)
    const value = await AsyncStorage.getItem(storageKey)

    if (!value) return null

    return parse ? JSON.parse(value) : value
  } catch (error) {
    console.error(`Error loading ${key}:`, error)
    return null
  }
}

/**
 * Remove data from AsyncStorage
 */
export const removeFromStorage = async (key, userId = null) => {
  try {
    const storageKey = getUserKey(key, userId)
    await AsyncStorage.removeItem(storageKey)
    return true
  } catch (error) {
    console.error(`Error removing ${key}:`, error)
    return false
  }
}

/**
 * Remove multiple items from AsyncStorage
 */
export const removeMultipleFromStorage = async (keys, userId = null) => {
  try {
    const storageKeys = keys.map((key) => getUserKey(key, userId))
    await AsyncStorage.multiRemove(storageKeys)
    return true
  } catch (error) {
    console.error("Error removing multiple items:", error)
    return false
  }
}

/**
 * Storage keys constants
 */
export const STORAGE_KEYS = {
  WORKOUT_DATA: "workoutData",
  SELECTED_PERSON: "selectedPerson",
  CURRENT_DAY: "currentDay",
  COMPLETED_DAYS: "completedDays",
  LOCKED_DAYS: "lockedDays",
  UNLOCKED_OVERRIDES: "unlockedOverrides",
  LAST_RESET_DATE: "lastResetDate",
  TIME_BETWEEN_SETS: "timeBetweenSets",
  WORKOUT_START_TIME: "workoutStartTime",
  CURRENT_SESSION_ID: "currentSessionId",
  IS_DEMO_MODE: "isDemoMode",
  USE_MANUAL_TIME: "useManualTime",
  PENDING_SYNCS: "pendingSyncs",
  LAST_ACTIVITY_TIME: "lastActivityTime",
}
