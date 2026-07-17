import AsyncStorage from "@react-native-async-storage/async-storage"
import { getServerUrl } from "@shared/services/config"
import { tokenStorage } from "@shared/services/tokenStorage"
import type { AuthResponse, AuthUser } from "../../types"

const USER_KEY = "@user"

export const authService = {
  /**
   * Sign up a new user
   * POST /api/auth/signup
   */
  signup: async (
    username: string,
    email: string,
    password: string,
    name: string | null = null,
  ): Promise<AuthResponse> => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          ...(name && { name }),
        }),
      })

      const data: AuthResponse = await response.json()
      if (!response.ok) throw new Error((data as any).error || "Signup failed")

      if (data.success && data.token) {
        await tokenStorage.set(data.token)
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user))
      }

      return data
    } catch (error) {
      console.error("Error signing up:", error)
      throw error
    }
  },

  /**
   * Sign in existing user
   * POST /api/auth/signin
   */
  signin: async (username: string, password: string): Promise<AuthResponse> => {
    const API_BASE_URL = getServerUrl()

    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
    } catch (error) {
      console.error("Error signing in (network):", error)
      throw error
    }

    let data: AuthResponse
    try {
      data = await response.json()
    } catch (error) {
      console.error("Error signing in (invalid server response):", error)
      throw new Error("Unexpected server response")
    }

    if (!response.ok) {
      console.warn(
        "Signin rejected:",
        (data as any).error || `HTTP ${response.status}`,
      )
      throw new Error((data as any).error || "Invalid username or password")
    }

    if (data.success && data.token) {
      await tokenStorage.set(data.token)
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user))
    }

    return data
  },

  /**
   * Get current user
   * GET /api/auth/me
   */
  getCurrentUser: async (): Promise<AuthUser> => {
    try {
      const API_BASE_URL = getServerUrl()
      const token = await tokenStorage.get()
      if (!token) throw new Error("No authentication token")

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to get user")

      return data.user as AuthUser
    } catch (error) {
      console.error("Error getting current user:", error)
      throw error
    }
  },

  /**
   * Update user profile
   * PUT /api/auth/profile
   */
  updateProfile: async (name: string, email: string): Promise<AuthUser> => {
    try {
      const API_BASE_URL = getServerUrl()
      const token = await tokenStorage.get()
      if (!token) throw new Error("No authentication token")

      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email }),
      })

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to update profile")

      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user))
      return data.user as AuthUser
    } catch (error) {
      console.error("Error updating profile:", error)
      throw error
    }
  },

  /**
   * Change password
   * PUT /api/auth/password
   */
  changePassword: async (
    currentPassword: string,
    newPassword: string,
  ): Promise<unknown> => {
    try {
      const API_BASE_URL = getServerUrl()
      const token = await tokenStorage.get()
      if (!token) throw new Error("No authentication token")

      const response = await fetch(`${API_BASE_URL}/api/auth/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to change password")

      return data
    } catch (error) {
      console.error("Error changing password:", error)
      throw error
    }
  },

  getToken: async (): Promise<string | null> => {
    return await tokenStorage.get()
  },

  refreshToken: async (): Promise<string | null> => {
    try {
      const API_BASE_URL = getServerUrl()
      const current = await tokenStorage.get()
      if (!current) return null

      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current}`,
        },
      })

      const data = await response.json()
      if (!response.ok) {
        console.warn(
          "Token refresh rejected:",
          (data as any).error || `HTTP ${response.status}`,
        )
        return null
      }

      if (data && (data.token || data.accessToken)) {
        const newToken = (data.token as string) || (data.accessToken as string)
        await tokenStorage.set(newToken)
        return newToken
      }
      return null
    } catch (error) {
      console.warn("Error refreshing token:", error)
      return null
    }
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await tokenStorage.get()
    return !!token
  },

  logout: async (): Promise<void> => {
    await tokenStorage.clear()
    await AsyncStorage.removeItem(USER_KEY)
  },

  getStoredUser: async (): Promise<AuthUser | null> => {
    const userJson = await AsyncStorage.getItem(USER_KEY)
    return userJson ? (JSON.parse(userJson) as AuthUser) : null
  },
}
