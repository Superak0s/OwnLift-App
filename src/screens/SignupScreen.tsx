import React, { useState } from "react"
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
import { useAlert } from "../components/CustomAlert"
import { useTheme } from "../context/ThemeContext"

type RootStackParamList = {
  Login: undefined
  Signup: undefined
}

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Signup">
}

export default function SignupScreen({
  navigation,
}: SignupScreenProps): React.JSX.Element {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [username, setUsername] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [name, setName] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [confirmPassword, setConfirmPassword] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false)
  const { signup } = useAuth()
  const { alert, AlertComponent } = useAlert()

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value)
  }

  const validateUsername = (value: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    return usernameRegex.test(value)
  }

  const validatePassword = (value: string): boolean => {
    return value.length >= 8
  }

  const validateForm = (): boolean => {
    if (!username || !email || !password || !confirmPassword) {
      alert(
        "Error",
        "Please fill in all required fields",
        [{ text: "OK" }],
        "error",
      )
      return false
    }

    if (!validateUsername(username)) {
      alert(
        "Invalid Username",
        "Username must be 3-20 characters long and contain only letters, numbers, and underscores",
        [{ text: "OK" }],
        "error",
      )
      return false
    }

    if (!validateEmail(email)) {
      alert(
        "Invalid Email",
        "Please enter a valid email address",
        [{ text: "OK" }],
        "error",
      )
      return false
    }

    if (!validatePassword(password)) {
      alert(
        "Weak Password",
        "Password must be at least 8 characters long",
        [{ text: "OK" }],
        "error",
      )
      return false
    }

    if (password !== confirmPassword) {
      alert(
        "Password Mismatch",
        "Passwords do not match",
        [{ text: "OK" }],
        "error",
      )
      return false
    }

    return true
  }

  const handleSignup = async (): Promise<void> => {
    if (!validateForm()) {
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

      setIsLoading(false)

      if (!result.success) {
        alert(
          "Signup Failed",
          result.error || "Could not create account",
          [{ text: "OK" }],
          "error",
        )
      }
    } catch (error) {
      setIsLoading(false)
      alert(
        "Error",
        "An unexpected error occurred. Please try again.",
        [{ text: "OK" }],
        "error",
      )
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
          keyboardShouldPersistTaps="handled"
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
                  placeholder="Choose a username"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
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
                  placeholder="your.email@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Name Input (Optional) */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
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
                    placeholder="Create a strong password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.eyeIcon}>
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.inputHint}>Minimum 8 characters</Text>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Confirm Password <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Re-enter your password"
                    placeholderTextColor={colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Text style={styles.eyeIcon}>
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Signup Button */}
              <TouchableOpacity
                style={[styles.signupButton, isLoading && styles.signupButtonDisabled]}
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
                By signing up, you agree to our Terms of Service and Privacy Policy
              </Text>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
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

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 30, alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
  form: { width: "100%" },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 8 },
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
  inputHint: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontStyle: "italic" },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: colors.textPrimary },
  eyeButton: { padding: 16 },
  eyeIcon: { fontSize: 20 },
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
  signupButtonText: { color: colors.surface, fontSize: 18, fontWeight: "bold" },
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
