import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { authService } from "@features/auth/services/index";
import { onServerUrlChange } from "../services/config";
import { getAppMode, isServerless, onAppModeChange } from "../services/appMode";
import { Alert } from "react-native";
import { tokenStorage } from "../services/tokenStorage";
import logger from "../services/logger";
import type { User } from "../types";

export type { User };

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue {
  user: User | null;
  /** Raw JWT string, always up-to-date */
  authToken: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  signup: (
    username: string,
    email: string,
    password: string,
    name: string,
  ) => Promise<AuthResult>;
  signin: (username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateProfile: (name: string, email: string) => Promise<AuthResult>;
  refreshUser: () => Promise<AuthResult>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const readStoredToken = async (): Promise<string> => {
  try {
    return (await tokenStorage.get()) ?? "";
  } catch {
    return "";
  }
};

// How often to proactively refresh the token (ms).
// Set to 55 minutes so a 1-hour expiry is covered with headroom.
const TOKEN_REFRESH_INTERVAL_MS = 55 * 60 * 1000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState("");

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setAuthToken("");
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  /**
   * In serverless ("offline") mode there's no server to authenticate against, so
   * we skip the login screen entirely: load (or create) the single local
   * profile and mark the session authenticated. Safe to call repeatedly —
   * the offline auth service just loads the existing local profile.
   */
  const autoConnectOffline = useCallback(async (): Promise<void> => {
    try {
      const data = (await authService.signin("Me", "")) as {
        success: boolean;
        user?: User;
        token?: string;
      };
      if (data.success && data.user) {
        const token = data.token ?? (await readStoredToken());
        setAuthToken(token);
        setUser(data.user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Offline auto-connect failed:", error);
    }
  }, []);

  /**
   * Attempts a silent token refresh via the auth service.
   * Falls back to logout if the server rejects the refresh.
   * Returns true when a new token was obtained.
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const newToken = await authService.refreshToken();
      if (newToken) {
        setAuthToken(newToken);
        logger.info("✅ Token refreshed silently");
        return true;
      }
      console.warn("⚠️ Token refresh returned empty — logging out");
      await logout();
      return false;
    } catch (error) {
      console.warn("⚠️ Token refresh failed, logging out:", error);
      await logout();
      return false;
    }
  }, [logout]);

  // Proactive refresh interval — keeps the session alive without the user
  // noticing. If the server doesn't support /auth/refresh yet, this is a
  // no-op until that endpoint is added.
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      void refreshToken();
    }, TOKEN_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshToken]);

  useEffect(() => {
    void checkAuthStatus();
  }, []);

  // React to runtime app-mode toggles (e.g. the Login screen's toggle):
  // switching to offline auto-connects with no login; switching to server
  // mode drops the local session so a real login is required.
  useEffect(() => {
    const unsubscribe = onAppModeChange.subscribe((mode) => {
      if (mode === "offline") void autoConnectOffline();
      else void logout();
    });
    return unsubscribe;
  }, [autoConnectOffline, logout]);

  useEffect(() => {
    const unsubscribe = onServerUrlChange(() => {
      if (isAuthenticated) {
        logger.info("🔄 Server URL changed, logging out user");
        Alert.alert(
          "Server Changed",
          "The server URL has been changed. You will be logged out.",
          [{ text: "OK", onPress: () => void logout() }],
        );
      }
    });
    return unsubscribe;
  }, [isAuthenticated, logout]);

  const checkAuthStatus = useCallback(async (): Promise<void> => {
    try {
      // Make sure the persisted app mode is loaded before we decide whether
      // this is a serverless session (which never shows a login screen).
      await getAppMode();
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        try {
          const currentUser = (await authService.getCurrentUser()) as User;
          const token = await readStoredToken();
          setAuthToken(token);
          setUser(currentUser);
          setIsAuthenticated(true);
          logger.info("✅ Valid session restored for:", currentUser.username);
        } catch {
          console.warn(
            "⚠️ Stored token is expired or invalid — attempting refresh",
          );
          const refreshed = await refreshToken();
          if (!refreshed) {
            await authService.logout();
            setAuthToken("");
            setUser(null);
            setIsAuthenticated(false);
          } else {
            try {
              const currentUser = (await authService.getCurrentUser()) as User;
              setUser(currentUser);
              setIsAuthenticated(true);
            } catch {
              await logout();
            }
          }
        }
      } else if (await isServerless()) {
        await autoConnectOffline();
      } else {
        setAuthToken("");
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsAuthenticated(false);
      setAuthToken("");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [logout, refreshToken, autoConnectOffline]);

  const signup = useCallback(
    async (
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
        )) as { success: boolean; user?: User; token?: string; error?: string };
        if (data.success && data.user) {
          const token = data.token ?? (await readStoredToken());
          setAuthToken(token);
          setUser(data.user);
          setIsAuthenticated(true);
          return { success: true };
        }
        return { success: false, error: data.error ?? "Signup failed" };
      } catch (error) {
        console.error("Signup error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Network error",
        };
      }
    },
    [],
  );

  const signin = useCallback(
    async (username: string, password: string): Promise<AuthResult> => {
      try {
        const data = (await authService.signin(username, password)) as {
          success: boolean;
          user?: User;
          token?: string;
          error?: string;
          message?: string;
        };
        if (data.success && data.user) {
          const token = data.token ?? (await readStoredToken());
          setAuthToken(token);
          setUser(data.user);
          setIsAuthenticated(true);
          return { success: true };
        }
        return {
          success: false,
          error: data.error ?? data.message ?? "Invalid username or password",
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Network error",
        };
      }
    },
    [],
  );

  const updateProfile = useCallback(
    async (name: string, email: string): Promise<AuthResult> => {
      try {
        const updatedUser = (await authService.updateProfile(
          name,
          email,
        )) as User;
        setUser(updatedUser);
        return { success: true };
      } catch (error) {
        console.error("Update profile error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Update failed",
        };
      }
    },
    [],
  );

  const refreshUser = useCallback(async (): Promise<AuthResult> => {
    try {
      const currentUser = (await authService.getCurrentUser()) as User;
      setUser(currentUser);
      return { success: true };
    } catch (error) {
      console.error("Refresh user error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Refresh failed",
      };
    }
  }, []);

  const value: AuthContextValue = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
