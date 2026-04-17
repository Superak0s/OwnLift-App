import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useAuth } from "../context/AuthContext"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  getServerUrl,
  setServerUrl,
  resetServerUrl,
  getDefaultServerUrl,
} from "../services/api"
import ModalSheet from "../components/ModalSheet"
import { useAlert } from "../components/CustomAlert"
import { useTheme } from "../context/ThemeContext"

type RootStackParamList = {
  Login: undefined
  Signup: undefined
}

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Login">
}

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export default function LoginScreen({
  navigation,
}: LoginScreenProps): React.JSX.Element {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [usernameOrEmail, setUsernameOrEmail] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showServerModal, setShowServerModal] = useState<boolean>(false)
  const [tempServerUrl, setTempServerUrl] = useState<string>("")
  const [currentServerUrl, setCurrentServerUrl] = useState<string>("")

  // Rate limiting state
  const [failedAttempts, setFailedAttempts] = useState<number>(0)
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false)
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null)
  const [remainingLockoutSeconds, setRemainingLockoutSeconds] =
    useState<number>(0)

  const { signin } = useAuth()
  const { alert, AlertComponent } = useAlert()

  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef<boolean>(true)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (lockoutTimerRef.current) {
        clearInterval(lockoutTimerRef.current)
      }
    }
  }, [])

  // Initialize server URL
  useEffect(() => {
    setCurrentServerUrl(getServerUrl())
  }, [])

  // Handle lockout timer
  useEffect(() => {
    if (isLockedOut && lockoutEndTime) {
      lockoutTimerRef.current = setInterval(() => {
        const now = Date.now()
        const remaining = Math.max(0, Math.ceil((lockoutEndTime - now) / 1000))

        if (isMountedRef.current) {
          setRemainingLockoutSeconds(remaining)

          if (remaining === 0) {
            setIsLockedOut(false)
            setLockoutEndTime(null)
            setFailedAttempts(0)
            if (lockoutTimerRef.current) {
              clearInterval(lockoutTimerRef.current)
            }
          }
        }
      }, 1000)

      return () => {
        if (lockoutTimerRef.current) {
          clearInterval(lockoutTimerRef.current)
        }
      }
    }
  }, [isLockedOut, lockoutEndTime])

  const clearSensitiveData = useCallback(() => {
    setPassword("")
  }, [])

  const handleLogin = async (): Promise<void> => {
    if (isLockedOut) {
      alert(
        "Account Locked",
        `Too many failed attempts. Please try again in ${remainingLockoutSeconds} seconds.`,
        [{ text: "OK" }],
        "warning",
      )
      return
    }

    if (!usernameOrEmail.trim() || !password) {
      alert(
        "Error",
        "Please enter your username/email and password",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    setIsLoading(true)

    try {
      const result = await signin(usernameOrEmail.trim(), password)

      if (result.success) {
        // Clear sensitive data on success
        clearSensitiveData()
        setFailedAttempts(0)
      } else {
        // Clear password on failure
        clearSensitiveData()

        // Increment failed attempts
        const newFailedAttempts = failedAttempts + 1
        setFailedAttempts(newFailedAttempts)

        // Check if we should lock out
        if (newFailedAttempts >= MAX_LOGIN_ATTEMPTS) {
          const endTime = Date.now() + LOCKOUT_DURATION_MS
          setIsLockedOut(true)
          setLockoutEndTime(endTime)

          alert(
            "Account Locked",
            `Too many failed login attempts. Your account has been temporarily locked for 5 minutes.`,
            [{ text: "OK" }],
            "error",
          )
        } else {
          const attemptsRemaining = MAX_LOGIN_ATTEMPTS - newFailedAttempts
          alert(
            "Login Failed",
            `${result.error || "Invalid username/email or password"}\n\n${attemptsRemaining} attempt${attemptsRemaining !== 1 ? "s" : ""} remaining.`,
            [{ text: "OK" }],
            "error",
          )
        }
      }
    } catch (error) {
      clearSensitiveData()
      console.error("Login error:", error)
      alert(
        "Error",
        "An unexpected error occurred. Please check your connection and try again.",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenServerModal = useCallback((): void => {
    setTempServerUrl(currentServerUrl)
    setShowServerModal(true)
  }, [currentServerUrl])

  const validateServerUrl = useCallback(
    (url: string): { valid: boolean; message?: string } => {
      const trimmedUrl = url.trim()

      if (!trimmedUrl) {
        return { valid: false, message: "Please enter a server URL" }
      }

      if (
        !trimmedUrl.startsWith("http://") &&
        !trimmedUrl.startsWith("https://")
      ) {
        return {
          valid: false,
          message: "URL must start with http:// or https://",
        }
      }

      // Check for HTTP in production (non-localhost)
      if (
        trimmedUrl.startsWith("http://") &&
        !trimmedUrl.includes("localhost") &&
        !trimmedUrl.includes("127.0.0.1") &&
        !trimmedUrl.includes("192.168.") &&
        !trimmedUrl.includes("10.0.")
      ) {
        return {
          valid: false,
          message:
            "HTTP is not secure. Please use HTTPS for production servers.",
        }
      }

      try {
        new URL(trimmedUrl)
        return { valid: true }
      } catch {
        return { valid: false, message: "Invalid URL format" }
      }
    },
    [],
  )

  const handleSaveServerUrl = useCallback(async (): Promise<void> => {
    const url = tempServerUrl.trim()
    const validation = validateServerUrl(url)

    if (!validation.valid) {
      alert(
        "Invalid URL",
        validation.message || "Please enter a valid URL",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    // Warn about local/development URLs
    if (
      url.startsWith("http://") &&
      (url.includes("localhost") ||
        url.includes("127.0.0.1") ||
        url.includes("192.168.") ||
        url.includes("10.0."))
    ) {
      alert(
        "Development Server",
        "You're connecting to a local development server. This should only be used for testing.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: async () => {
              await saveUrl(url)
            },
          },
        ],
        "warning",
      )
      return
    }

    await saveUrl(url)
  }, [tempServerUrl, validateServerUrl])

  const saveUrl = async (url: string): Promise<void> => {
    const success = await setServerUrl(url)
    if (success) {
      setCurrentServerUrl(url)
      setShowServerModal(false)
      alert(
        "Success",
        "Server URL updated successfully!",
        [{ text: "OK" }],
        "success",
      )
    } else {
      alert("Error", "Failed to save server URL", [{ text: "OK" }], "error")
    }
  }

  const handleResetServerUrl = useCallback(async (): Promise<void> => {
    alert(
      "Reset Server URL?",
      `This will reset the server URL to the default: ${getDefaultServerUrl()}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: async () => {
            const success = await resetServerUrl()
            if (success) {
              setCurrentServerUrl(getDefaultServerUrl())
              setTempServerUrl(getDefaultServerUrl())
              setShowServerModal(false)
              alert(
                "Success",
                "Server URL reset to default successfully!",
                [{ text: "OK" }],
                "success",
              )
            } else {
              alert(
                "Error",
                "Failed to reset server URL",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "warning",
    )
  }, [alert])

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>💪 Workout Tracker</Text>
              <Text style={styles.subtitle}>
                Sign in to continue your fitness journey
              </Text>
            </View>

            {/* Lockout Warning */}
            {isLockedOut && (
              <View style={styles.lockoutBanner}>
                <Text style={styles.lockoutIcon}>🔒</Text>
                <View style={styles.lockoutContent}>
                  <Text style={styles.lockoutTitle}>
                    Account Temporarily Locked
                  </Text>
                  <Text style={styles.lockoutText}>
                    Too many failed attempts. Try again in{" "}
                    {remainingLockoutSeconds}s
                  </Text>
                </View>
              </View>
            )}

            {/* Server Configuration Badge */}
            <TouchableOpacity
              style={styles.serverBadge}
              onPress={handleOpenServerModal}
              disabled={isLoading}
            >
              <Text style={styles.serverIcon}>🌐</Text>
              <View style={styles.serverBadgeContent}>
                <Text style={styles.serverBadgeLabel}>Server</Text>
                <Text style={styles.serverBadgeUrl} numberOfLines={1}>
                  {currentServerUrl}
                </Text>
              </View>
              <Text style={styles.serverBadgeArrow}>⚙️</Text>
            </TouchableOpacity>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Username or Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder='Enter username or email'
                  placeholderTextColor={colors.textMuted}
                  value={usernameOrEmail}
                  onChangeText={setUsernameOrEmail}
                  autoCapitalize='none'
                  autoCorrect={false}
                  keyboardType='email-address'
                  editable={!isLoading && !isLockedOut}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder='Enter your password'
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize='none'
                    editable={!isLoading && !isLockedOut}
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading || isLockedOut}
                  >
                    <Text style={styles.eyeIcon}>
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.forgotPassword}
                disabled={isLockedOut}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  (isLoading || isLockedOut) && styles.loginButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={isLoading || isLockedOut}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.loginButtonText}>
                    {isLockedOut ? "Locked" : "Sign In"}
                  </Text>
                )}
              </TouchableOpacity>

              {failedAttempts > 0 && !isLockedOut && (
                <Text style={styles.attemptsWarning}>
                  ⚠️ {MAX_LOGIN_ATTEMPTS - failedAttempts} attempt
                  {MAX_LOGIN_ATTEMPTS - failedAttempts !== 1 ? "s" : ""}{" "}
                  remaining
                </Text>
              )}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.signupButton}
                onPress={() => navigation.navigate("Signup")}
                disabled={isLoading}
              >
                <Text style={styles.signupButtonText}>Create New Account</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                By continuing, you agree to our{"\n"}
                <Text style={styles.footerLink}>Terms of Service</Text> and{" "}
                <Text style={styles.footerLink}>Privacy Policy</Text>
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* ── Server URL Modal ── */}
        <ModalSheet
          visible={showServerModal}
          onClose={() => setShowServerModal(false)}
          title='Server Configuration'
          onConfirm={handleSaveServerUrl}
          confirmText='Save'
        >
          <Text style={styles.modalDescription}>
            Enter the URL of your workout tracker server (including http:// or
            https://)
          </Text>
          <TextInput
            style={styles.modalInput}
            value={tempServerUrl}
            onChangeText={setTempServerUrl}
            keyboardType='url'
            placeholder='https://api.example.com'
            placeholderTextColor={colors.textMuted}
            autoCapitalize='none'
            autoCorrect={false}
          />
          <View style={styles.modalWarning}>
            <Text style={styles.modalWarningIcon}>⚠️</Text>
            <Text style={styles.modalWarningText}>
              Always use HTTPS for production servers to ensure your data is
              encrypted
            </Text>
          </View>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetServerUrl}
          >
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
          <Text style={styles.modalHelperText}>
            💡 Make sure you can reach this server before logging in
          </Text>
        </ModalSheet>

        {AlertComponent}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, paddingBottom: 40 },
    content: { padding: 20, paddingTop: 60, minHeight: "100%" },
    header: { marginBottom: 24, alignItems: "center" },
    title: {
      fontSize: 36,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
    },
    lockoutBanner: {
      backgroundColor: "#ff444420",
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "#ff4444",
    },
    lockoutIcon: { fontSize: 24, marginRight: 12 },
    lockoutContent: { flex: 1 },
    lockoutTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#ff4444",
      marginBottom: 4,
    },
    lockoutText: { fontSize: 14, color: "#ff4444" },
    serverBadge: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    serverIcon: { fontSize: 20, marginRight: 12 },
    serverBadgeContent: { flex: 1 },
    serverBadgeLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
      marginBottom: 2,
    },
    serverBadgeUrl: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    serverBadgeArrow: { fontSize: 18, marginLeft: 8 },
    form: { width: "100%" },
    inputContainer: { marginBottom: 20 },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    passwordContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    passwordInput: {
      flex: 1,
      padding: 16,
      fontSize: 16,
      color: colors.textPrimary,
    },
    eyeButton: { padding: 16 },
    eyeIcon: { fontSize: 20 },
    forgotPassword: { alignSelf: "flex-end", marginBottom: 20 },
    forgotPasswordText: {
      fontSize: 14,
      color: colors.accent,
      fontWeight: "600",
    },
    loginButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    loginButtonDisabled: { opacity: 0.6 },
    loginButtonText: {
      color: colors.surface,
      fontSize: 18,
      fontWeight: "bold",
    },
    attemptsWarning: {
      fontSize: 14,
      color: "#ff8800",
      textAlign: "center",
      marginTop: 12,
      fontWeight: "600",
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 30,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.surfaceBorder },
    dividerText: {
      marginHorizontal: 16,
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: "600",
    },
    signupButton: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.accent,
    },
    signupButtonText: {
      color: colors.accent,
      fontSize: 18,
      fontWeight: "bold",
    },
    footer: { marginTop: 40, alignItems: "center" },
    footerText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 18,
    },
    footerLink: { color: colors.accent, fontWeight: "600" },
    modalDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 22,
    },
    modalInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      marginBottom: 16,
    },
    modalWarning: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: "#ff880020",
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderLeftWidth: 3,
      borderLeftColor: "#ff8800",
    },
    modalWarningIcon: { fontSize: 16, marginRight: 8, marginTop: 2 },
    modalWarningText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    resetButton: {
      backgroundColor: colors.surfaceBorder,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 16,
    },
    resetButtonText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    modalHelperText: {
      fontSize: 13,
      color: colors.accent,
      textAlign: "center",
      fontStyle: "italic",
    },
  })
