import React, { useState, useEffect } from "react"
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

export default function LoginScreen({
  navigation,
}: LoginScreenProps): React.JSX.Element {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [usernameOrEmail, setUsernameOrEmail] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showServerModal, setShowServerModal] = useState<boolean>(false)
  const [tempServerUrl, setTempServerUrl] = useState<string>("")
  const [currentServerUrl, setCurrentServerUrl] = useState<string>("")
  const { signin } = useAuth()
  const { alert, AlertComponent } = useAlert()

  useEffect(() => {
    setCurrentServerUrl(getServerUrl())
  }, [])

  const handleLogin = async (): Promise<void> => {
    if (!usernameOrEmail || !password) {
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
      setIsLoading(false)
      if (!result.success) {
        alert(
          "Login Failed",
          result.error || "Invalid username/email or password",
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

  const handleOpenServerModal = (): void => {
    setTempServerUrl(currentServerUrl)
    setShowServerModal(true)
  }

  const handleSaveServerUrl = async (): Promise<void> => {
    const url = tempServerUrl.trim()

    if (!url) {
      alert("Invalid URL", "Please enter a server URL", [{ text: "OK" }], "error")
      return
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      alert(
        "Invalid URL",
        "URL must start with http:// or https://",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    const success = await setServerUrl(url)
    if (success) {
      setCurrentServerUrl(url)
      setShowServerModal(false)
      alert("Success", "Server URL updated successfully!", [{ text: "OK" }], "success")
    } else {
      alert("Error", "Failed to save server URL", [{ text: "OK" }], "error")
    }
  }

  const handleResetServerUrl = async (): Promise<void> => {
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
              setShowServerModal(false)
              alert(
                "Success",
                "Server URL reset to default successfully!",
                [{ text: "OK" }],
                "success",
              )
            } else {
              alert("Error", "Failed to reset server URL", [{ text: "OK" }], "error")
            }
          },
        },
      ],
      "warning",
    )
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
              <Text style={styles.title}>💪 Workout Tracker</Text>
              <Text style={styles.subtitle}>
                Sign in to continue your fitness journey
              </Text>
            </View>

            {/* Server Configuration Badge */}
            <TouchableOpacity
              style={styles.serverBadge}
              onPress={handleOpenServerModal}
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
                  placeholder="Enter username or email"
                  placeholderTextColor={colors.textMuted}
                  value={usernameOrEmail}
                  onChangeText={setUsernameOrEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
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
              </View>

              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.signupButton}
                onPress={() => navigation.navigate("Signup")}
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
          title="Server Configuration"
          onConfirm={handleSaveServerUrl}
          confirmText="Save"
        >
          <Text style={styles.modalDescription}>
            Enter the URL of your workout tracker server (including http:// or
            https://)
          </Text>
          <TextInput
            style={styles.modalInput}
            value={tempServerUrl}
            onChangeText={setTempServerUrl}
            keyboardType="url"
            placeholder="http://192.168.1.100:3000"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
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

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  content: { padding: 20, paddingTop: 60, minHeight: "100%" },
  header: { marginBottom: 24, alignItems: "center" },
  title: { fontSize: 36, fontWeight: "bold", color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: "center" },
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
  serverBadgeUrl: { fontSize: 14, color: colors.textPrimary, fontWeight: "500" },
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
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: colors.textPrimary },
  eyeButton: { padding: 16 },
  eyeIcon: { fontSize: 20 },
  forgotPassword: { alignSelf: "flex-end", marginBottom: 20 },
  forgotPasswordText: { fontSize: 14, color: colors.accent, fontWeight: "600" },
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
  loginButtonText: { color: colors.surface, fontSize: 18, fontWeight: "bold" },
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
  signupButtonText: { color: colors.accent, fontSize: 18, fontWeight: "bold" },
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
  resetButton: {
    backgroundColor: colors.surfaceBorder,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  resetButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
  modalHelperText: {
    fontSize: 13,
    color: colors.accent,
    textAlign: "center",
    fontStyle: "italic",
  },
})
