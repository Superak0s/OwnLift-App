import AsyncStorage from "@react-native-async-storage/async-storage"
import { getServerUrl } from "@shared/services/config"
import { tokenStorage } from "@shared/services/tokenStorage"
import { apiCall, parseApiResponse } from "@shared/services/apiClient"
import type { AuthResponse, AuthUser } from "../../types"

const USER_KEY = "@user"

/**
 * Helper for unauthenticated endpoints (signup, signin).
 * Uses raw fetch + parseApiResponse instead of apiCall (which wraps authenticatedFetch).
 */
async function unauthenticatedCall<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getServerUrl()}${path}`
  const response = await fetch(url, options)
  return parseApiResponse(response)
}

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
    const data = await unauthenticatedCall<AuthResponse>(
      `/api/auth/signup`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          ...(name && { name }),
        }),
      },
    )

    if (data.success && data.token) {
      await tokenStorage.set(data.token)
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user))
    }

    return data
  },

  /**
   * Sign in existing user
   * POST /api/auth/signin
   */
  signin: async (username: string, password: string): Promise<AuthResponse> => {
    const data = await unauthenticatedCall<AuthResponse>(
      `/api/auth/signin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      },
    )

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
    const data = await apiCall<{ user: AuthUser }>(`/api/auth/me`)
    return data.user
  },

  /**
   * Update user profile
   * PUT /api/auth/profile
   */
  updateProfile: async (name: string, email: string): Promise<AuthUser> => {
    const data = await apiCall<{ user: AuthUser }>(`/api/auth/profile`, {
      method: "PUT",
      body: JSON.stringify({ name, email }),
    })
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data.user
  },

  /**
   * Change password
   * PUT /api/auth/password
   */
  changePassword: async (
    currentPassword: string,
    newPassword: string,
  ): Promise<unknown> =>
    apiCall(`/api/auth/password`, {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  getToken: async (): Promise<string | null> => {
    return await tokenStorage.get()
  },

  refreshToken: async (): Promise<string | null> => {
    try {
      const current = await tokenStorage.get()
      if (!current) return null

      const response = await fetch(`${getServerUrl()}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current}`,
        },
      })

      const data = await parseApiResponse<{ token?: string; accessToken?: string }>(response)
      if (data.token || data.accessToken) {
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
