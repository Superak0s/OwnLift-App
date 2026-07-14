// shared/services/tokenStorage.tsx
import AsyncStorage from "@react-native-async-storage/async-storage"

const AUTH_TOKEN_KEY = "@auth_token"

export const tokenStorage = {
  get: async (): Promise<string | null> => {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY)
  },
  set: async (token: string): Promise<void> => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token)
  },
  clear: async (): Promise<void> => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY)
  },
}
