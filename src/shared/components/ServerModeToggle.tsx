import React from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import type { AppMode } from "../../services/api"

interface ServerModeToggleProps {
  mode: AppMode
  onChange: (mode: AppMode) => void
  colors: any
  disabled?: boolean
  /** Short helper line shown under the toggle, describing the active mode. */
  showHelperText?: boolean
}

/**
 * Segmented "Server / Offline" control. Purely presentational — callers own
 * persisting the choice (via services/api's setAppMode) and reacting to it.
 */
export default function ServerModeToggle({
  mode,
  onChange,
  colors,
  disabled = false,
  showHelperText = true,
}: ServerModeToggleProps): React.JSX.Element {
  const styles = makeStyles(colors)

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.option, mode === "on" && styles.optionActive]}
          onPress={() => onChange("on")}
          disabled={disabled}
          accessibilityRole='button'
          accessibilityState={{ selected: mode === "on" }}
        >
          <Text
            style={[
              styles.optionText,
              mode === "on" && styles.optionTextActive,
            ]}
          >
            🌐 Server
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, mode === "off" && styles.optionActive]}
          onPress={() => onChange("off")}
          disabled={disabled}
          accessibilityRole='button'
          accessibilityState={{ selected: mode === "off" }}
        >
          <Text
            style={[
              styles.optionText,
              mode === "off" && styles.optionTextActive,
            ]}
          >
            📴 Offline
          </Text>
        </TouchableOpacity>
      </View>

      {showHelperText && (
        <Text style={styles.helperText}>
          {mode === "on"
            ? "Syncing with your server"
            : "Everything stays on this device — no server needed"}
        </Text>
      )}
    </View>
  )
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    wrapper: { marginBottom: 20 },
    container: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    option: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    optionActive: {
      backgroundColor: colors.accent,
    },
    optionText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    optionTextActive: {
      color: colors.surface,
    },
    helperText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 8,
      fontStyle: "italic",
    },
  })
