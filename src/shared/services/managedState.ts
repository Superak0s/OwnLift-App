import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * Factory that produces a reactive, persisted state bucket backed by
 * AsyncStorage.  Eliminates the copy-paste listener pattern that existed
 * in both config.tsx and appMode.tsx.
 *
 * Returns:
 *   - get(): T               synchronous read of current value
 *   - set(v: T): Promise<boolean>  persist + notify if changed
 *   - onChange(cb): () => void     subscribe, returns unsubscribe
 *   - ensureLoaded(): Promise<void> guarantee async init has run
 *   - reset?(): Promise<boolean>   optional reset to default
 */
export function createManagedState<T extends string | number | boolean>(
  storageKey: string,
  defaultValue: T,
  options?: {
    /** Validate the value read from storage before accepting it */
    validate?: (raw: string) => T | null
  },
) {
  let currentValue: T = defaultValue
  let loaded = false
  const listeners: Array<(value: T) => void> = []
  let initPromise: Promise<void> | null = null

  const notify = (value: T): void => {
    listeners.forEach((cb) => cb(value))
  }

  const initialize = async (): Promise<void> => {
    try {
      const raw = await AsyncStorage.getItem(storageKey)
      if (raw !== null) {
        const parsed = options?.validate?.(raw) ?? (raw as T)
        if (parsed !== null) currentValue = parsed
      }
    } catch (err) {
      console.error(`Error loading ${storageKey}:`, err)
    } finally {
      loaded = true
    }
  }

  const get = (): T => currentValue

  const set = async (value: T): Promise<boolean> => {
    try {
      const previous = currentValue
      await AsyncStorage.setItem(storageKey, String(value))
      currentValue = value
      if (previous !== value) notify(value)
      return true
    } catch (err) {
      console.error(`Error saving ${storageKey}:`, err)
      return false
    }
  }

  const reset = async (): Promise<boolean> => {
    try {
      const previous = currentValue
      await AsyncStorage.removeItem(storageKey)
      currentValue = defaultValue
      if (previous !== defaultValue) notify(defaultValue)
      return true
    } catch (err) {
      console.error(`Error resetting ${storageKey}:`, err)
      return false
    }
  }

  const onChange = (callback: (value: T) => void): (() => void) => {
    listeners.push(callback)
    return () => {
      const idx = listeners.indexOf(callback)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }

  const ensureLoaded = async (): Promise<void> => {
    if (!loaded) {
      initPromise ??= initialize()
      await initPromise
    }
  }

  return { get, set, reset, onChange, ensureLoaded }
}
