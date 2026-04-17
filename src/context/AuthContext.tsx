import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { authService, onServerUrlChange } from "../services/api"
import { Alert } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  email?: string
  name?: string
  [key: string]: unknown
}

interface AuthResult {
  success: boolean
  error?: string
}

interface AuthContextValue {
  user: User | null
  /** Raw JWT string, always up-to-date */
  authToken: string
  isAuthenticated: boolean
  isLoading: boolean
  signup: (
    username: string,
    email: string,
    password: string,
    name: string,
  ) => Promise<AuthResult>
  signin: (username: string, password: string) => Promise<AuthResult>
  logout: () => Promise<void>
  updateProfile: (name: string, email: string) => Promise<AuthResult>
  refreshUser: () => Promise<AuthResult>
  /** Call this to attempt a silent token refresh. Returns true on success. */
  refreshToken: () => Promise<boolean>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read the stored JWT without throwing. Returns empty string on failure. */
const readStoredToken = async (): Promise<string> => {
  try {
    return (await AsyncStorage.getItem("@auth_token")) ?? ""
  } catch {
    return ""
  }
}

// How often to proactively refresh the token (ms).
// Set to 55 minutes so a 1-hour expiry is covered with headroom.
const TOKEN_REFRESH_INTERVAL_MS = 55 * 60 * 1000

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authToken, setAuthToken] = useState("")

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout()
    } catch (error) {
      console.error("Error logging out:", error)
    } finally {
      setAuthToken("")
      setUser(null)
      setIsAuthenticated(false)
    }
  }, [])

  // ── Token refresh ─────────────────────────────────────────────────────────
  /**
   * Attempts a silent token refresh via the auth service.
   * Falls back to logout if the server rejects the refresh.
   * Returns true when a new token was obtained.
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      // authService.refreshToken() should POST to your /auth/refresh endpoint
      // and persist the new JWT in AsyncStorage.
      const newToken = await (
        authService as unknown as {
          refreshToken: () => Promise<string | null>
        }
      ).refreshToken()
      if (newToken) {
        setAuthToken(newToken)
        console.log("✅ Token refreshed silently")
        return true
      }
      // Refresh returned nothing — token is gone, force logout
      console.warn("⚠️ Token refresh returned empty — logging out")
      await logout()
      return false
    } catch (error) {
      console.warn("⚠️ Token refresh failed, logging out:", error)
      await logout()
      return false
    }
  }, [logout])

  // Proactive refresh interval — keeps the session alive without the user
  // noticing. If the server doesn't support /auth/refresh yet, this is a
  // no-op until that endpoint is added.
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(() => {
      void refreshToken()
    }, TOKEN_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isAuthenticated, refreshToken])

  useEffect(() => {
    void checkAuthStatus()
  }, [])

  useEffect(() => {
    const unsubscribe = onServerUrlChange(() => {
      if (isAuthenticated) {
        console.log("🔄 Server URL changed, logging out user")
        Alert.alert(
          "Server Changed",
          "The server URL has been changed. You will be logged out.",
          [{ text: "OK", onPress: () => void logout() }],
        )
      }
    })
    return unsubscribe
  }, [isAuthenticated, logout])

  // ── checkAuthStatus ───────────────────────────────────────────────────────
  const checkAuthStatus = useCallback(async (): Promise<void> => {
    try {
      const isAuth = await authService.isAuthenticated()
      if (isAuth) {
        try {
          const currentUser = (await authService.getCurrentUser()) as User
          const token = await readStoredToken()
          setAuthToken(token)
          setUser(currentUser)
          setIsAuthenticated(true)
          console.log("✅ Valid session restored for:", currentUser.username)
        } catch {
          console.warn(
            "⚠️ Stored token is expired or invalid — attempting refresh",
          )
          // Try a refresh before giving up and clearing the session
          const refreshed = await refreshToken()
          if (!refreshed) {
            await authService.logout()
            setAuthToken("")
            setUser(null)
            setIsAuthenticated(false)
          } else {
            // Retry loading the user after a successful refresh
            try {
              const currentUser = (await authService.getCurrentUser()) as User
              setUser(currentUser)
              setIsAuthenticated(true)
            } catch {
              await logout()
            }
          }
        }
      } else {
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
  }, [logout, refreshToken])

  // ── signup ────────────────────────────────────────────────────────────────
  const signup = async (
    username: string,
    email: string,
    password: string,
    name: string,
  ): Promise<AuthResult> => {
    try {
      const data = (await authService.signup(
        username,
        email,
        password,
        name,
      )) as { success: boolean; user?: User; token?: string; error?: string }
      if (data.success && data.user) {
        const token = data.token ?? (await readStoredToken())
        setAuthToken(token)
        setUser(data.user)
        setIsAuthenticated(true)
        return { success: true }
      }
      return { success: false, error: data.error ?? "Signup failed" }
    } catch (error) {
      console.error("Signup error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      }
    }
  }

  // ── signin ────────────────────────────────────────────────────────────────
  const signin = async (
    username: string,
    password: string,
  ): Promise<AuthResult> => {
    try {
      const data = (await authService.signin(username, password)) as {
        success: boolean
        user?: User
        token?: string
        error?: string
      }
      if (data.success && data.user) {
        const token = data.token ?? (await readStoredToken())
        setAuthToken(token)
        setUser(data.user)
        setIsAuthenticated(true)
        return { success: true }
      }
      return { success: false, error: data.error ?? "Login failed" }
    } catch (error) {
      console.error("Signin error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      }
    }
  }

  // ── updateProfile ─────────────────────────────────────────────────────────
  const updateProfile = async (
    name: string,
    email: string,
  ): Promise<AuthResult> => {
    try {
      const updatedUser = (await authService.updateProfile(name, email)) as User
      setUser(updatedUser)
      return { success: true }
    } catch (error) {
      console.error("Update profile error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Update failed",
      }
    }
  }

  // ── refreshUser ───────────────────────────────────────────────────────────
  const refreshUser = async (): Promise<AuthResult> => {
    try {
      const currentUser = (await authService.getCurrentUser()) as User
      setUser(currentUser)
      return { success: true }
    } catch (error) {
      console.error("Refresh user error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Refresh failed",
      }
    }
  }

  const value: AuthContextValue = {
    user,
    authToken,
    isAuthenticated,
    isLoading,
    signup,
    signin,
    logout,
    updateProfile,
    refreshUser,
    refreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
