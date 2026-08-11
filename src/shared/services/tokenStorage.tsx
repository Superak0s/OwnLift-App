import * as SecureStore from "expo-secure-store"

const SECURE_TOKEN_KEY = "auth_token"

export const tokenStorage = {
  get: async (): Promise<string | null> => {
    return await SecureStore.getItemAsync(SECURE_TOKEN_KEY)
  },
  set: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token)
  },
  clear: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY)
  },
}
