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
  /** Raw JWT string, always up-to-date – no extra AsyncStorage read needed */
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authToken, setAuthToken] = useState("")

  // ── logout is defined early so the server-URL effect can reference it ──────
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

  useEffect(() => {
    void checkAuthStatus()
  }, [])

  // Listen for server URL changes and logout if it happens.
  // `logout` is stable (useCallback with no deps) so this effect won't
  // re-register unnecessarily.
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

  const checkAuthStatus = async (): Promise<void> => {
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
            "⚠️ Stored token is expired or invalid, clearing session",
          )
          await authService.logout()
          setAuthToken("")
          setUser(null)
          setIsAuthenticated(false)
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
  }

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
        // Prefer token returned by the service; fall back to AsyncStorage read
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

  const updateProfile = async (
    name: string,
    email: string,
  ): Promise<AuthResult> => {
    try {
      const updatedUser = (await authService.updateProfile(
        name,
        email,
      )) as User
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
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
