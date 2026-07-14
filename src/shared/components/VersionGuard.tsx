import React, { useEffect, useState, useRef, type ReactNode } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native"
import {
  validateServerVersion,
  compareVersions,
  parseVersion,
} from "../../services/on/versionService"
import { useAlert } from "./CustomAlert"
import * as Linking from "expo-linking"
import { useTheme } from "../context/ThemeContext"
import {
  getServerUrl,
  setServerUrl,
  resetServerUrl,
  getDefaultServerUrl,
  getAppMode,
  setAppMode,
  isServerless,
  ensureAppModeLoaded,
  onAppModeChange,
} from "../../services/api"
import type { AppMode } from "../../services/api"
import ModalSheet from "./ModalSheet"
import ServerModeToggle from "./ServerModeToggle"

// ─── Types ────────────────────────────────────────────────────────────────────

interface VersionStatus {
  checked: boolean
  compatible: boolean | null
  clientVersion: string | null
  serverVersion: string | null
  reason: string | null
  isRetrying: boolean
  clientNeedsUpdate: boolean
}

interface VersionGuardProps {
  children: ReactNode
  onVersionChecked?: (compatible: boolean) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VersionGuard({
  children,
  onVersionChecked,
}: VersionGuardProps) {
  const [versionStatus, setVersionStatus] = useState<VersionStatus>({
    checked: false,
    compatible: null,
    clientVersion: null,
    serverVersion: null,
    reason: null,
    isRetrying: false,
    clientNeedsUpdate: false,
  })

  // Server URL modal state
  const [showServerModal, setShowServerModal] = useState(false)
  const [tempServerUrl, setTempServerUrl] = useState("")
  const [currentServerUrl, setCurrentServerUrl] = useState("")
  const [appMode, setAppModeState] = useState<AppMode>("on")

  const { alert, AlertComponent } = useAlert()
  // Prevents concurrent calls to checkVersion (e.g. rapid taps on "Retry")
  const checkingRef = useRef(false)
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  useEffect(() => {
    setCurrentServerUrl(getServerUrl())
    void ensureAppModeLoaded().then((): void => {
      const mode = getAppMode()
      setAppModeState(mode)
      void checkVersion(mode)
    })
    return onAppModeChange((mode) => {
      setAppModeState(mode)
    })
  }, [])

  const checkVersion = async (modeOverride?: AppMode) => {
    if (checkingRef.current) return
    checkingRef.current = true

    // Offline mode has no server to be compatible or incompatible with —
    // skip the check entirely and let the app through.
    const mode = modeOverride ?? appMode
    if (mode === "off" || isServerless()) {
      setVersionStatus({
        checked: true,
        compatible: true,
        clientVersion: null,
        serverVersion: null,
        reason: null,
        isRetrying: false,
        clientNeedsUpdate: false,
      })
      onVersionChecked?.(true)
      checkingRef.current = false
      return
    }

    try {
      setVersionStatus((prev) => ({ ...prev, isRetrying: true }))
      console.log("🔍 Checking server version compatibility...")

      const result = await validateServerVersion()

      console.log("📋 Version check result:", {
        compatible: result.compatible,
        clientVersion: result.clientVersion,
        serverVersion: result.serverVersion,
      })

      const clientNeedsUpdate =
        result.serverVersion != null &&
        compareVersions(
          parseVersion(result.clientVersion),
          parseVersion(result.serverVersion),
        ) < 0

      setVersionStatus({
        checked: true,
        compatible: result.compatible,
        clientVersion: result.clientVersion,
        serverVersion: result.serverVersion,
        reason: result.reason ?? null,
        isRetrying: false,
        clientNeedsUpdate,
      })

      onVersionChecked?.(result.compatible)
    } catch (error) {
      console.error("❌ Unexpected error during version check:", error)
      setVersionStatus({
        checked: true,
        compatible: false,
        clientVersion: null,
        serverVersion: null,
        reason: "An unexpected error occurred during version verification.",
        isRetrying: false,
        clientNeedsUpdate: false,
      })
    } finally {
      checkingRef.current = false
    }
  }

  // ── Mode toggle helpers ──────────────────────────────────────────────────────

  const handleModeChange = async (mode: AppMode): Promise<void> => {
    const success = await setAppMode(mode)
    if (success) {
      setAppModeState(mode)
      setShowServerModal(false)
      setVersionStatus((prev) => ({ ...prev, checked: false }))
      void checkVersion(mode)
    } else {
      alert("Error", "Failed to switch mode", [{ text: "OK" }], "error")
    }
  }

  // ── Server URL helpers ──────────────────────────────────────────────────────

  const handleOpenServerModal = () => {
    setTempServerUrl(currentServerUrl)
    setShowServerModal(true)
  }

  const validateServerUrl = (
    url: string,
  ): { valid: boolean; message?: string } => {
    const trimmed = url.trim()
    if (!trimmed) return { valid: false, message: "Please enter a server URL" }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://"))
      return {
        valid: false,
        message: "URL must start with http:// or https://",
      }
    if (
      trimmed.startsWith("http://") &&
      !trimmed.includes("localhost") &&
      !trimmed.includes("127.0.0.1") &&
      !trimmed.includes("192.168.") &&
      !trimmed.includes("10.0.")
    )
      return {
        valid: false,
        message: "HTTP is not secure. Please use HTTPS for production servers.",
      }
    try {
      new URL(trimmed)
      return { valid: true }
    } catch {
      return { valid: false, message: "Invalid URL format" }
    }
  }

  const saveUrl = async (url: string) => {
    const success = await setServerUrl(url)
    if (success) {
      setCurrentServerUrl(url)
      setShowServerModal(false)
      // Immediately re-check version against new server
      setVersionStatus((prev) => ({ ...prev, checked: false }))
      void checkVersion()
    } else {
      alert("Error", "Failed to save server URL", [{ text: "OK" }], "error")
    }
  }

  const handleSaveServerUrl = async () => {
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

    const isLocal =
      url.startsWith("http://") &&
      (url.includes("localhost") ||
        url.includes("127.0.0.1") ||
        url.includes("192.168.") ||
        url.includes("10.0."))

    if (isLocal) {
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
  }

  const handleResetServerUrl = () => {
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
              const def = getDefaultServerUrl()
              setCurrentServerUrl(def)
              setTempServerUrl(def)
              setShowServerModal(false)
              setVersionStatus((prev) => ({ ...prev, checked: false }))
              void checkVersion()
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

  // ── Render: loading ─────────────────────────────────────────────────────────

  if (!versionStatus.checked) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingEmoji}>🔄</Text>
          <Text style={styles.loadingText}>
            Verifying server compatibility...
          </Text>

          {/* Mode toggle — allow switching to offline even mid-check */}
          <ServerModeToggle
            mode={appMode}
            onChange={handleModeChange}
            colors={colors}
          />

          {/* Allow changing server even during the loading state */}
          {appMode === "on" && (
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
          )}
        </View>

        {AlertComponent}
        <ModalSheet
          visible={showServerModal}
          onClose={() => setShowServerModal(false)}
          title='Server Configuration'
          onConfirm={handleSaveServerUrl}
          confirmText='Save & Retry'
        >
          <ServerModalContent
            tempServerUrl={tempServerUrl}
            setTempServerUrl={setTempServerUrl}
            onReset={handleResetServerUrl}
            colors={colors}
            styles={styles}
          />
        </ModalSheet>
      </View>
    )
  }

  // ── Render: incompatible ────────────────────────────────────────────────────

  if (!versionStatus.compatible) {
    return (
      <View style={styles.container}>
        {AlertComponent}
        <View style={styles.errorBox}>
          <View style={styles.errorHeader}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Incompatible Server Version</Text>
          </View>

          <View style={styles.errorContent}>
            <Text style={styles.errorMessage}>{versionStatus.reason}</Text>
            <View style={styles.versionInfo}>
              <Text style={styles.versionLabel}>Client Version:</Text>
              <Text style={styles.versionValue}>
                {versionStatus.clientVersion ?? "Unknown"}
              </Text>
              <Text style={styles.versionLabel}>Server Version:</Text>
              <Text style={styles.versionValue}>
                {versionStatus.serverVersion ?? "Unable to connect"}
              </Text>
            </View>
          </View>

          {/* Mode toggle — can't reach or match this server? Go offline instead */}
          <ServerModeToggle
            mode={appMode}
            onChange={handleModeChange}
            colors={colors}
          />

          {/* Server badge — tap to change */}
          <TouchableOpacity
            style={styles.serverBadge}
            onPress={handleOpenServerModal}
          >
            <Text style={styles.serverIcon}>🌐</Text>
            <View style={styles.serverBadgeContent}>
              <Text style={styles.serverBadgeLabel}>Connected server</Text>
              <Text style={styles.serverBadgeUrl} numberOfLines={1}>
                {currentServerUrl}
              </Text>
            </View>
            <Text style={styles.serverBadgeArrow}>⚙️</Text>
          </TouchableOpacity>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                versionStatus.clientNeedsUpdate
                  ? styles.buttonSecondary
                  : styles.buttonPrimary,
              ]}
              onPress={() => void checkVersion()}
              disabled={versionStatus.isRetrying}
            >
              <Text
                style={
                  versionStatus.clientNeedsUpdate
                    ? styles.buttonTextSecondary
                    : styles.buttonTextPrimary
                }
              >
                {versionStatus.isRetrying ? "Retrying..." : "Retry"}
              </Text>
            </TouchableOpacity>

            {versionStatus.clientNeedsUpdate && (
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={() =>
                  void Linking.openURL(
                    "https://github.com/Superak0s/SuperGym-App/releases",
                  )
                }
              >
                <Text style={styles.buttonTextPrimary}>Download Update</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.footnote}>
            If you believe this is an error, contact support.
          </Text>
        </View>

        <ModalSheet
          visible={showServerModal}
          onClose={() => setShowServerModal(false)}
          title='Server Configuration'
          onConfirm={handleSaveServerUrl}
          confirmText='Save & Retry'
        >
          <ServerModalContent
            tempServerUrl={tempServerUrl}
            setTempServerUrl={setTempServerUrl}
            onReset={handleResetServerUrl}
            colors={colors}
            styles={styles}
          />
        </ModalSheet>
      </View>
    )
  }

  // ── Render: compatible ──────────────────────────────────────────────────────
  return <>{children}</>
}

// ─── Extracted modal body (shared between loading + error states) ─────────────

function ServerModalContent({
  tempServerUrl,
  setTempServerUrl,
  onReset,
  colors,
  styles,
}: {
  tempServerUrl: string
  setTempServerUrl: (v: string) => void
  onReset: () => void
  colors: any
  styles: any
}) {
  return (
    <>
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
      <TouchableOpacity style={styles.resetButton} onPress={onReset}>
        <Text style={styles.resetButtonText}>Reset to Default</Text>
      </TouchableOpacity>
      <Text style={styles.modalHelperText}>
        💡 Saving will immediately re-check compatibility with the new server
      </Text>
    </>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      width: "100%",
    },
    loadingEmoji: { fontSize: 48, marginBottom: 12 },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 24,
    },
    errorBox: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      margin: 20,
      padding: 24,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
      width: "90%",
    },
    errorHeader: { alignItems: "center", marginBottom: 20 },
    errorIcon: { fontSize: 48, marginBottom: 12 },
    errorTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },
    errorContent: { marginBottom: 16 },
    errorMessage: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
      textAlign: "center",
      marginBottom: 20,
    },
    versionInfo: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
    },
    versionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
      marginTop: 8,
      marginBottom: 4,
    },
    versionValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
      fontFamily: "monospace",
    },
    // Server badge
    serverBadge: {
      backgroundColor: colors.inputBackground ?? colors.surface,
      borderRadius: 12,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
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
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    serverBadgeArrow: { fontSize: 18, marginLeft: 8 },
    // Action buttons
    buttonContainer: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
      justifyContent: "center",
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      minWidth: "45%",
    },
    buttonPrimary: { backgroundColor: colors.accent },
    buttonSecondary: {
      backgroundColor: colors.separator,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    buttonTextPrimary: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.surface,
    },
    buttonTextSecondary: { fontSize: 15, fontWeight: "600", color: "#374151" },
    footnote: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      fontStyle: "italic",
    },
    // Modal
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
