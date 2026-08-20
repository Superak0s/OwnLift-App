import { getStorageItem, setStorageItem, removeStorageItem } from "@shared/services/sqliteStorage"
import { getServerUrl } from "@shared/services/config"
import { tokenStorage } from "@shared/services/tokenStorage"
import { apiCall, parseApiResponse } from "@shared/services/apiClient"
import type { AuthResponse, AuthUser } from "../../types"

const USER_KEY = "@user"
const FETCH_TIMEOUT_MS = 15000

/**
 * Helper for unauthenticated endpoints (signup, signin).
 * Uses raw fetch + parseApiResponse instead of apiCall (which wraps authenticatedFetch).
 */
async function unauthenticatedCall<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getServerUrl()}${path}`
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return await parseApiResponse<T>(response)
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutHandle)
  }
}

export const authService = {
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
      await setStorageItem(USER_KEY, JSON.stringify(data.user))
    }

    return data
  },

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
      await setStorageItem(USER_KEY, JSON.stringify(data.user))
    }

    return data
  },

  getCurrentUser: async (): Promise<AuthUser> => {
    const data = await apiCall<{ user: AuthUser }>(`/api/auth/me`)
    return data.user
  },

  updateProfile: async (name: string, email: string): Promise<AuthUser> => {
    const data = await apiCall<{ user: AuthUser }>(`/api/auth/profile`, {
      method: "PUT",
      body: JSON.stringify({ name, email }),
    })
    await setStorageItem(USER_KEY, JSON.stringify(data.user))
    return data.user
  },

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
    await removeStorageItem(USER_KEY)
  },

  getStoredUser: async (): Promise<AuthUser | null> => {
    const userJson = await getStorageItem(USER_KEY)
    return userJson ? (JSON.parse(userJson) as AuthUser) : null
  },
}
