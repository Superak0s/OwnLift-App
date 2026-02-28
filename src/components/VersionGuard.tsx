import React, { useEffect, useState, useRef, type ReactNode } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import {
  validateServerVersion,
  compareVersions,
  parseVersion,
} from "../services/versionService"
import { useAlert } from "./CustomAlert"
import * as Linking from "expo-linking"

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
  const { alert, AlertComponent } = useAlert()
  // Prevents concurrent calls to checkVersion (e.g. rapid taps on "Retry")
  const checkingRef = useRef(false)

  useEffect(() => {
    void checkVersion()
  }, [])

  const checkVersion = async () => {
    if (checkingRef.current) return
    checkingRef.current = true

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

  // Still checking
  if (!versionStatus.checked) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingEmoji}>🔄</Text>
          <Text style={styles.loadingText}>
            Verifying server compatibility...
          </Text>
        </View>
      </View>
    )
  }

  // Version mismatch – show blocker
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
      </View>
    )
  }

  // Version is compatible – render app
  return <>{children}</>
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingBox: { alignItems: "center", justifyContent: "center" },
  loadingEmoji: { fontSize: 48, marginBottom: 12 },
  loadingText: { fontSize: 16, color: "#666", textAlign: "center" },
  errorBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    margin: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  errorHeader: { alignItems: "center", marginBottom: 20 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  errorContent: { marginBottom: 24 },
  errorMessage: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 20,
  },
  versionInfo: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#667eea",
  },
  versionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 8,
    marginBottom: 4,
  },
  versionValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    fontFamily: "monospace",
  },
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
  buttonPrimary: { backgroundColor: "#667eea" },
  buttonSecondary: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  buttonTextPrimary: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
  buttonTextSecondary: { fontSize: 15, fontWeight: "600", color: "#374151" },
  footnote: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    fontStyle: "italic",
  },
})
