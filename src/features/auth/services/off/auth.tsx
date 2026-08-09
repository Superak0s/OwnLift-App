import { getStorageItem, setStorageItem } from "@shared/services/sqliteStorage"
import { tokenStorage } from "@shared/services/tokenStorage"
import { generateId } from "@utils/format"
import type { AuthResponse, AuthUser } from "../../types"

const LOCAL_USER_KEY = "@offline_user"
const LOCAL_USER_ID = "local"

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
    await setStorageItem(LOCAL_USER_KEY, JSON.stringify(user))
    await tokenStorage.set(generateId("offline"))
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
    await setStorageItem(LOCAL_USER_KEY, JSON.stringify(user))
    await tokenStorage.set(generateId("offline"))
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
    await setStorageItem(LOCAL_USER_KEY, JSON.stringify(updated))
    return updated
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
    const userJson = await getStorageItem(LOCAL_USER_KEY)
    return userJson ? (JSON.parse(userJson) as AuthUser) : null
  },

  refreshToken: async (): Promise<string | null> => {
    const user = await authService.getStoredUser()
    if (!user) return null
    const token = generateId("offline")
    await tokenStorage.set(token)
    return token
  },
}
