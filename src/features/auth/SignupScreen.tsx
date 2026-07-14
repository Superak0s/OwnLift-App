import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
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
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuth } from "@shared/context/AuthContext"
import { useTheme } from "@shared/context/ThemeContext"
import { useAlert } from "@shared/components/CustomAlert"
import type { RootStackParamList } from "./types"

interface PasswordStrength {
  score: number // 0-4
  label: string
  color: string
  feedback: string[]
}

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Signup">
}

interface PasswordStrength {
  score: number // 0-4
  label: string
  color: string
  feedback: string[]
}

export default function SignupScreen({
  navigation,
}: SignupScreenProps): React.JSX.Element {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [username, setUsername] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [name, setName] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [confirmPassword, setConfirmPassword] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false)
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrength | null>(null)

  const { signup } = useAuth()
  const { alert, AlertComponent } = useAlert()

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const clearSensitiveData = useCallback(() => {
    setPassword("")
    setConfirmPassword("")
  }, [])

  const validateEmail = useCallback((value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value)
  }, [])

  const validateUsername = useCallback((value: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    return usernameRegex.test(value)
  }, [])

  const calculatePasswordStrength = useCallback(
    (value: string): PasswordStrength => {
      if (!value) {
        return {
          score: 0,
          label: "No password",
          color: "#999",
          feedback: ["Enter a password"],
        }
      }

      let score = 0
      const feedback: string[] = []

      // Length check
      if (value.length >= 8) score++
      else feedback.push("Use at least 8 characters")

      if (value.length >= 12) score++

      // Complexity checks
      if (/[a-z]/.test(value) && /[A-Z]/.test(value)) {
        score++
      } else {
        feedback.push("Mix uppercase and lowercase letters")
      }

      if (/\d/.test(value)) {
        score++
      } else {
        feedback.push("Include at least one number")
      }

      if (/[^a-zA-Z0-9]/.test(value)) {
        score++
      } else {
        feedback.push("Add a special character (!@#$%^&*)")
      }

      // Common patterns that reduce strength
      if (/^[a-z]+$/.test(value) || /^[A-Z]+$/.test(value)) {
        score = Math.max(0, score - 1)
        feedback.push("Avoid using only letters")
      }

      if (/^[0-9]+$/.test(value)) {
        score = Math.max(0, score - 2)
        feedback.push("Avoid using only numbers")
      }

      if (/(.)\1{2,}/.test(value)) {
        score = Math.max(0, score - 1)
        feedback.push("Avoid repeating characters")
      }

      // Common words check (basic)
      const commonWords = ["password", "123456", "qwerty", "abc123", "letmein"]
      if (commonWords.some((word) => value.toLowerCase().includes(word))) {
        score = Math.max(0, score - 2)
        feedback.push("Avoid common words and patterns")
      }

      // Normalize score to 0-4
      const normalizedScore = Math.min(4, Math.floor(score / 1.2))

      let label = ""
      let color = ""

      switch (normalizedScore) {
        case 0:
          label = "Very Weak"
          color = "#ff4444"
          break
        case 1:
          label = "Weak"
          color = "#ff8800"
          break
        case 2:
          label = "Fair"
          color = "#ffbb00"
          break
        case 3:
          label = "Good"
          color = "#88cc00"
          break
        case 4:
          label = "Strong"
          color = "#00cc44"
          break
      }

      return {
        score: normalizedScore,
        label,
        color,
        feedback:
          feedback.length > 0 ? feedback.slice(0, 2) : ["Great password!"],
      }
    },
    [],
  )

  const handlePasswordChange = useCallback(
    (value: string) => {
      setPassword(value)
      const strength = calculatePasswordStrength(value)
      setPasswordStrength(strength)
    },
    [calculatePasswordStrength],
  )

  const validateForm = useCallback((): { valid: boolean; message?: string } => {
    if (!username || !email || !password || !confirmPassword) {
      return {
        valid: false,
        message: "Please fill in all required fields",
      }
    }

    if (!validateUsername(username)) {
      return {
        valid: false,
        message:
          "Username must be 3-20 characters long and contain only letters, numbers, and underscores",
      }
    }

    if (!validateEmail(email)) {
      return {
        valid: false,
        message: "Please enter a valid email address",
      }
    }

    // Enforce strong password requirements
    if (password.length < 8) {
      return {
        valid: false,
        message: "Password must be at least 8 characters long",
      }
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
      return {
        valid: false,
        message: "Password must contain both uppercase and lowercase letters",
      }
    }

    if (!/\d/.test(password)) {
      return {
        valid: false,
        message: "Password must contain at least one number",
      }
    }

    if (password !== confirmPassword) {
      return {
        valid: false,
        message: "Passwords do not match",
      }
    }

    // Recommend special characters but don't require
    if (
      !/[^a-zA-Z0-9]/.test(password) &&
      passwordStrength &&
      passwordStrength.score < 3
    ) {
      return {
        valid: false,
        message: "For better security, add a special character (!@#$%^&*)",
      }
    }

    return { valid: true }
  }, [
    username,
    email,
    password,
    confirmPassword,
    validateUsername,
    validateEmail,
    passwordStrength,
  ])

  const handleSignup = async (): Promise<void> => {
    const validation = validateForm()

    if (!validation.valid) {
      alert(
        "Validation Error",
        validation.message || "Please check your input",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    setIsLoading(true)

    try {
      const result = await signup(
        username.trim(),
        email.trim().toLowerCase(),
        password,
        name.trim() || "",
      )

      if (isMountedRef.current) {
        setIsLoading(false)

        if (result.success) {
          // Clear sensitive data on success
          clearSensitiveData()
          // Navigation will be handled by AuthContext
        } else {
          // Clear passwords on failure
          clearSensitiveData()

          // Use generic error message to prevent username/email enumeration
          const errorMessage =
            result.error?.toLowerCase().includes("username") ||
            result.error?.toLowerCase().includes("email") ||
            result.error?.toLowerCase().includes("exists")
              ? "Unable to create account with these credentials. Please try different ones."
              : result.error || "Could not create account. Please try again."

          alert("Signup Failed", errorMessage, [{ text: "OK" }], "error")
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        setIsLoading(false)
        clearSensitiveData()
        console.error("Signup error:", error)

        alert(
          "Error",
          "An unexpected error occurred. Please check your connection and try again.",
          [{ text: "OK" }],
          "error",
        )
      }
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
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
              <Text style={styles.title}>💪 Create Account</Text>
              <Text style={styles.subtitle}>
                Join Workout Tracker to start your fitness journey
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Username Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Username <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder='Choose a username'
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize='none'
                  autoCorrect={false}
                  maxLength={20}
                  editable={!isLoading}
                />
                <Text style={styles.inputHint}>
                  3-20 characters, letters, numbers, and underscores only
                </Text>
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Email <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder='your.email@example.com'
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType='email-address'
                  autoCapitalize='none'
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>

              {/* Name Input (Optional) */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder='John Doe'
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize='words'
                  editable={!isLoading}
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Password <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder='Create a strong password'
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    autoCapitalize='none'
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    <Text style={styles.eyeIcon}>
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Password Strength Indicator */}
                {password && passwordStrength && (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthBarContainer}>
                      {[0, 1, 2, 3, 4].map((index) => (
                        <View
                          key={index}
                          style={[
                            styles.strengthBar,
                            {
                              backgroundColor:
                                index <= passwordStrength.score
                                  ? passwordStrength.color
                                  : colors.surfaceBorder,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <Text
                      style={[
                        styles.strengthLabel,
                        { color: passwordStrength.color },
                      ]}
                    >
                      {passwordStrength.label}
                    </Text>
                  </View>
                )}

                {/* Password Feedback */}
                {password && passwordStrength && passwordStrength.score < 3 && (
                  <View style={styles.feedbackContainer}>
                    {passwordStrength.feedback.map((tip, index) => (
                      <Text key={index} style={styles.feedbackText}>
                        • {tip}
                      </Text>
                    ))}
                  </View>
                )}

                <Text style={styles.inputHint}>
                  Minimum 8 characters with uppercase, lowercase, and numbers
                </Text>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Confirm Password <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder='Re-enter your password'
                    placeholderTextColor={colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize='none'
                    editable={!isLoading}
                    onSubmitEditing={handleSignup}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    <Text style={styles.eyeIcon}>
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </Text>
                  </TouchableOpacity>
                </View>
                {password &&
                  confirmPassword &&
                  password !== confirmPassword && (
                    <Text style={styles.errorText}>Passwords do not match</Text>
                  )}
              </View>

              {/* Signup Button */}
              <TouchableOpacity
                style={[
                  styles.signupButton,
                  isLoading && styles.signupButtonDisabled,
                ]}
                onPress={handleSignup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.signupButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Terms */}
              <Text style={styles.termsText}>
                By signing up, you agree to our Terms of Service and Privacy
                Policy
              </Text>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Login")}
                  disabled={isLoading}
                >
                  <Text style={styles.loginLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {AlertComponent}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, paddingBottom: 40 },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    header: { marginBottom: 30, alignItems: "center" },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    form: { width: "100%" },
    inputContainer: { marginBottom: 20 },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    required: { color: "#ff4444" },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    inputHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 6,
      fontStyle: "italic",
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
    strengthContainer: {
      marginTop: 12,
      marginBottom: 4,
    },
    strengthBarContainer: {
      flexDirection: "row",
      gap: 4,
      marginBottom: 8,
    },
    strengthBar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: "#ddd",
    },
    strengthLabel: {
      fontSize: 13,
      fontWeight: "600",
      textAlign: "right",
    },
    feedbackContainer: {
      marginTop: 8,
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: "#ff8800",
    },
    feedbackText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
      lineHeight: 16,
    },
    errorText: {
      fontSize: 12,
      color: "#ff4444",
      marginTop: 6,
      fontWeight: "600",
    },
    signupButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      marginTop: 10,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    signupButtonDisabled: { opacity: 0.6 },
    signupButtonText: {
      color: colors.surface,
      fontSize: 18,
      fontWeight: "bold",
    },
    termsText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 16,
      lineHeight: 18,
    },
    loginContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 24,
    },
    loginText: { fontSize: 15, color: colors.textSecondary },
    loginLink: { fontSize: 15, color: colors.accent, fontWeight: "bold" },
  })
