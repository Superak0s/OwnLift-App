// features/auth/services/on/auth.tsx

import AsyncStorage from "@react-native-async-storage/async-storage"
import { getServerUrl } from "@shared/services/config"
import { tokenStorage } from "@shared/services/tokenStorage"
import type { AuthResponse, AuthUser } from "../../types"

// AsyncStorage key for the cached user object (single source of truth).
const USER_KEY = "@user"

/**
 * Authentication Service
 *
 * Note: authenticatedFetch used to live in this file. It's moved to
 * shared/services/authenticatedFetch.tsx — every feature needs it for
 * its own "on" calls, and a feature-to-feature import would break the
 * shared → features → app import direction. Import it from there.
 */
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

    // Network-level failure (server unreachable, no connection, timeout, etc.)
    // — this is a genuine unexpected error, so it's worth an error-level log.
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

    // Malformed/non-JSON response — also unexpected, log it.
    let data: AuthResponse
    try {
      data = await response.json()
    } catch (error) {
      console.error("Error signing in (invalid server response):", error)
      throw new Error("Unexpected server response")
    }

    if (!response.ok) {
      // Expected failure case — wrong username/password, locked account, etc.
      // This isn't a bug, so we warn instead of throwing a loud console error.
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

  /** Get authentication token */
  getToken: async (): Promise<string | null> => {
    return await tokenStorage.get()
  },

  /** Check if user is authenticated */
  isAuthenticated: async (): Promise<boolean> => {
    const token = await tokenStorage.get()
    return !!token
  },

  /** Logout user */
  logout: async (): Promise<void> => {
    await tokenStorage.clear()
    await AsyncStorage.removeItem(USER_KEY)
  },

  /** Get stored user data */
  getStoredUser: async (): Promise<AuthUser | null> => {
    const userJson = await AsyncStorage.getItem(USER_KEY)
    return userJson ? (JSON.parse(userJson) as AuthUser) : null
  },
}
