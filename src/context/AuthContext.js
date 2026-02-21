import React, { createContext, useState, useContext, useEffect } from "react"
import { authService, onServerUrlChange } from "../services/api"
import { Alert } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Expose the raw JWT so any screen can attach it to Image headers
  // without needing an extra AsyncStorage read (and without a race condition).
  const [authToken, setAuthToken] = useState("")

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  // Listen for server URL changes and logout if it happens
  useEffect(() => {
    const unsubscribe = onServerUrlChange((newUrl) => {
      if (isAuthenticated) {
        console.log("🔄 Server URL changed, logging out user")
        Alert.alert(
          "Server Changed",
          "The server URL has been changed. You will be logged out.",
          [
            {
              text: "OK",
              onPress: async () => {
                await logout()
              },
            },
          ],
        )
      }
    })

    return unsubscribe // Cleanup on unmount
  }, [isAuthenticated])

  const checkAuthStatus = async () => {
    try {
      const isAuth = await authService.isAuthenticated()
      if (isAuth) {
        // Verify the stored token is actually valid by calling the API
        try {
          const currentUser = await authService.getCurrentUser()

          // Load the raw token into state so components can use it synchronously
          const token = await AsyncStorage.getItem("@auth_token")
          setAuthToken(token || "")

          setUser(currentUser)
          setIsAuthenticated(true)
          console.log("✅ Valid session restored for:", currentUser.username)
        } catch (error) {
          // Token exists in storage but is expired/invalid
          console.warn(
            "⚠️ Stored token is expired or invalid, clearing session",
          )
          await authService.logout()
          setAuthToken("")
          setUser(null)
          setIsAuthenticated(false)
        }
      } else {
        // No token in storage
        setAuthToken("")
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error("Error checking auth status:", error)
      setIsAuthenticated(false)
      setAuthToken("")
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (username, email, password, name) => {
    try {
      const data = await authService.signup(username, email, password, name)
      if (data.success) {
        // Capture token immediately after signup
        const token = await AsyncStorage.getItem("@auth_token")
        setAuthToken(token || "")
        setUser(data.user)
        setIsAuthenticated(true)
        return { success: true }
      }
      return { success: false, error: data.error || "Signup failed" }
    } catch (error) {
      console.error("Signup error:", error)
      return { success: false, error: error.message || "Network error" }
    }
  }

  const signin = async (username, password) => {
    try {
      const data = await authService.signin(username, password)
      if (data.success) {
        // Capture token immediately after signin so it's available
        // synchronously to all consumers (e.g. Image Authorization headers)
        const token = await AsyncStorage.getItem("@auth_token")
        setAuthToken(token || "")
        setUser(data.user)
        setIsAuthenticated(true)
        return { success: true }
      }
      return { success: false, error: data.error || "Login failed" }
    } catch (error) {
      console.error("Signin error:", error)
      return { success: false, error: error.message || "Network error" }
    }
  }

  const logout = async () => {
    try {
      await authService.logout()
      setAuthToken("")
      setUser(null)
      setIsAuthenticated(false)
    } catch (error) {
      console.error("Error logging out:", error)
      // Even if there's an error, clear local state
      setAuthToken("")
      setUser(null)
      setIsAuthenticated(false)
    }
  }

  const updateProfile = async (name, email) => {
    try {
      const updatedUser = await authService.updateProfile(name, email)
      setUser(updatedUser)
      return { success: true }
    } catch (error) {
      console.error("Update profile error:", error)
      return { success: false, error: error.message || "Update failed" }
    }
  }

  const refreshUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
      return { success: true }
    } catch (error) {
      console.error("Refresh user error:", error)
      return { success: false, error: error.message }
    }
  }

  const value = {
    user,
    authToken, // ← JWT string, always up-to-date, no AsyncStorage needed in screens
    isAuthenticated,
    isLoading,
    signup,
    signin,
    logout,
    updateProfile,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
