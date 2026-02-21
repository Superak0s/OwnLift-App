import AsyncStorage from "@react-native-async-storage/async-storage"
import { getServerUrl } from "./config"

/**
 * Authentication Service
 * Implements the documented authentication endpoints
 */
export const authService = {
  /**
   * Sign up a new user
   * POST /api/auth/signup
   */
  signup: async (username, email, password, name = null) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
          ...(name && { name }),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
      }

      // Store token and user data
      if (data.success && data.token) {
        await AsyncStorage.setItem("@auth_token", data.token)
        await AsyncStorage.setItem("@user", JSON.stringify(data.user))
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
  signin: async (username, password) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signin failed")
      }

      // Store token and user data
      if (data.success && data.token) {
        await AsyncStorage.setItem("@auth_token", data.token)
        await AsyncStorage.setItem("@user", JSON.stringify(data.user))
      }

      return data
    } catch (error) {
      console.error("Error signing in:", error)
      throw error
    }
  },

  /**
   * Get current user
   * GET /api/auth/me
   */
  getCurrentUser: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const token = await AsyncStorage.getItem("@auth_token")
      if (!token) {
        throw new Error("No authentication token")
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get user")
      }

      return data.user
    } catch (error) {
      console.error("Error getting current user:", error)
      throw error
    }
  },

  /**
   * Update user profile
   * PUT /api/auth/profile
   */
  updateProfile: async (name, email) => {
    try {
      const API_BASE_URL = getServerUrl()
      const token = await AsyncStorage.getItem("@auth_token")
      if (!token) {
        throw new Error("No authentication token")
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile")
      }

      // Update stored user data
      await AsyncStorage.setItem("@user", JSON.stringify(data.user))

      return data.user
    } catch (error) {
      console.error("Error updating profile:", error)
      throw error
    }
  },

  /**
   * Change password
   * PUT /api/auth/password
   */
  changePassword: async (currentPassword, newPassword) => {
    try {
      const API_BASE_URL = getServerUrl()
      const token = await AsyncStorage.getItem("@auth_token")
      if (!token) {
        throw new Error("No authentication token")
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password")
      }

      return data
    } catch (error) {
      console.error("Error changing password:", error)
      throw error
    }
  },

  /**
   * Get authentication token
   */
  getToken: async () => {
    return await AsyncStorage.getItem("@auth_token")
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: async () => {
    const token = await AsyncStorage.getItem("@auth_token")
    return !!token
  },

  /**
   * Logout user
   */
  logout: async () => {
    await AsyncStorage.removeItem("@auth_token")
    await AsyncStorage.removeItem("@user")
  },

  /**
   * Get stored user data
   */
  getStoredUser: async () => {
    const userJson = await AsyncStorage.getItem("@user")
    return userJson ? JSON.parse(userJson) : null
  },
}

/**
 * Helper function to make authenticated requests
 */
export const authenticatedFetch = async (url, options = {}) => {
  console.log(`[API] Calling: ${url}`)
  const token = await authService.getToken()

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // Handle token expiration
  if (response.status === 401) {
    const data = await response.json()
    if (data.error === "Token expired" || data.error?.includes("expired")) {
      console.warn("⚠️ Token expired - logging out user")
      await authService.logout()
      throw new Error("SESSION_EXPIRED")
    }
  }

  return response
}
