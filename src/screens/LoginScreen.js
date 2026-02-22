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

export default function LoginScreen({ navigation }) {
  const [usernameOrEmail, setUsernameOrEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showServerModal, setShowServerModal] = useState(false)
  const [tempServerUrl, setTempServerUrl] = useState("")
  const [currentServerUrl, setCurrentServerUrl] = useState("")
  const { signin } = useAuth()
  const { alert, AlertComponent } = useAlert()

  useEffect(() => {
    setCurrentServerUrl(getServerUrl())
  }, [])

  const handleLogin = async () => {
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

  const handleOpenServerModal = () => {
    setTempServerUrl(currentServerUrl)
    setShowServerModal(true)
  }

  const handleSaveServerUrl = async () => {
    const url = tempServerUrl.trim()

    if (!url) {
      alert(
        "Invalid URL",
        "Please enter a server URL",
        [{ text: "OK" }],
        "error",
      )
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

  const handleResetServerUrl = async () => {
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
  }

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
                  placeholder='Enter username or email'
                  placeholderTextColor='#999'
                  value={usernameOrEmail}
                  onChangeText={setUsernameOrEmail}
                  autoCapitalize='none'
                  autoCorrect={false}
                  keyboardType='email-address'
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder='Enter your password'
                    placeholderTextColor='#999'
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize='none'
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
                style={[
                  styles.loginButton,
                  isLoading && styles.loginButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color='#fff' />
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
            placeholder='http://192.168.1.100:3000'
            placeholderTextColor='#999'
            autoCapitalize='none'
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  content: { padding: 20, paddingTop: 60, minHeight: "100%" },
  header: { marginBottom: 24, alignItems: "center" },
  title: { fontSize: 36, fontWeight: "bold", color: "#333", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666", textAlign: "center" },
  serverBadge: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  serverIcon: { fontSize: 20, marginRight: 12 },
  serverBadgeContent: { flex: 1 },
  serverBadgeLabel: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
    marginBottom: 2,
  },
  serverBadgeUrl: { fontSize: 14, color: "#333", fontWeight: "500" },
  serverBadgeArrow: { fontSize: 18, marginLeft: 8 },
  form: { width: "100%" },
  inputContainer: { marginBottom: 20 },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: "#333" },
  eyeButton: { padding: 16 },
  eyeIcon: { fontSize: 20 },
  forgotPassword: { alignSelf: "flex-end", marginBottom: 20 },
  forgotPasswordText: { fontSize: 14, color: "#667eea", fontWeight: "600" },
  loginButton: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 30,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e0e0e0" },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: "#999",
    fontWeight: "600",
  },
  signupButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#667eea",
  },
  signupButtonText: { color: "#667eea", fontSize: 18, fontWeight: "bold" },
  footer: { marginTop: 40, alignItems: "center" },
  footerText: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    lineHeight: 18,
  },
  footerLink: { color: "#667eea", fontWeight: "600" },
  modalDescription: {
    fontSize: 15,
    color: "#666",
    marginBottom: 20,
    lineHeight: 22,
  },
  modalInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#333",
    borderWidth: 2,
    borderColor: "#e0e0e0",
    marginBottom: 16,
  },
  resetButton: {
    backgroundColor: "#e0e0e0",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  resetButtonText: { color: "#333", fontSize: 16, fontWeight: "600" },
  modalHelperText: {
    fontSize: 13,
    color: "#667eea",
    textAlign: "center",
    fontStyle: "italic",
  },
})
