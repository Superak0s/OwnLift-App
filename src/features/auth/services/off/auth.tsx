import AsyncStorage from "@react-native-async-storage/async-storage"
import { tokenStorage } from "@shared/services/tokenStorage"
import type { AuthResponse, AuthUser } from "../../types"

const LOCAL_USER_KEY = "@offline_user"
const LOCAL_USER_ID = "local"

const generateLocalToken = (): string =>
  `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const authService = {
  signup: async (
    username: string,
    email: string,
    _password: string,
    name: string | null = null,
  ): Promise<AuthResponse> => {
    const user: AuthUser = {
      id: LOCAL_USER_ID,
      username,
      email,
      ...(name && { name }),
    }
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user))
    await tokenStorage.set(generateLocalToken())
    return { success: true, token: "offline", user }
  },

  signin: async (
    username: string,
    _password: string,
  ): Promise<AuthResponse> => {
    const existing = await authService.getStoredUser()
    const user: AuthUser = existing || {
      id: LOCAL_USER_ID,
      username,
      email: "",
    }
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user))
    await tokenStorage.set(generateLocalToken())
    return { success: true, token: "offline", user }
  },

  getCurrentUser: async (): Promise<AuthUser> => {
    const user = await authService.getStoredUser()
    if (!user) throw new Error("No local profile found")
    return user
  },

  updateProfile: async (name: string, email: string): Promise<AuthUser> => {
    const existing = (await authService.getStoredUser()) || {
      id: LOCAL_USER_ID,
      username: "me",
      email: "",
    }
    const updated: AuthUser = { ...existing, name, email }
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updated))
    return updated
  },

  /** Nothing to change offline — kept for interface parity. */
  changePassword: async (): Promise<unknown> => {
    return { success: true }
  },

  getToken: async (): Promise<string | null> => {
    return await tokenStorage.get()
  },

  isAuthenticated: async (): Promise<boolean> => {
    return !!(await authService.getStoredUser())
  },

  logout: async (): Promise<void> => {
    await tokenStorage.clear()
  },

  getStoredUser: async (): Promise<AuthUser | null> => {
    const userJson = await AsyncStorage.getItem(LOCAL_USER_KEY)
    return userJson ? (JSON.parse(userJson) as AuthUser) : null
  },

  refreshToken: async (): Promise<string | null> => {
    const user = await authService.getStoredUser()
    if (!user) return null
    const token = generateLocalToken()
    await tokenStorage.set(token)
    return token
  },
}
