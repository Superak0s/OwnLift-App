import React, { useState, useCallback, type ReactElement } from "react"
import { useTheme } from "../context/ThemeContext"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import ModalSheet from "./ModalSheet"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "lock"
  | "session"
  | "default"

export interface AlertButton {
  text: string
  style?: "default" | "cancel" | "destructive"
  onPress?: () => void
}

interface AlertConfig {
  visible: boolean
  title: string
  message: string
  buttons: AlertButton[]
  type: AlertType
}

interface CustomAlertProps {
  visible: boolean
  title: string
  message: string
  buttons: AlertButton[]
  type: AlertType
  onDismiss: () => void
}

export interface UseAlertReturn {
  alert: (
    title: string,
    message: string,
    buttons?: AlertButton[],
    type?: AlertType,
  ) => void
  AlertComponent: ReactElement
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ICONS: Record<AlertType, string> = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i",
  lock: "🔒",
  session: "💪",
  default: "i",
}

const makeAccentColors = (colors: any): Record<AlertType, string> => ({
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
  info: colors.accent,
  lock: colors.textSecondary,
  session: colors.accent,
  default: colors.accent,
})

// ─── Component ────────────────────────────────────────────────────────────────

function CustomAlert({
  visible,
  title,
  message,
  buttons,
  type,
  onDismiss,
}: CustomAlertProps) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const ACCENT_COLORS = makeAccentColors(colors)
  const safeButtons =
    Array.isArray(buttons) && buttons.length > 0 ? buttons : [{ text: "OK" }]
  const safeType: AlertType = type ?? "default"
  const accent = ACCENT_COLORS[safeType]
  const icon = ICONS[safeType]

  return (
    <ModalSheet
      visible={visible}
      onClose={onDismiss}
      showCancelButton={false}
      showConfirmButton={false}
      dismissOnBackdropPress={false}
    >
      <View style={[styles.iconBadge, { backgroundColor: accent + "22" }]}>
        <Text style={[styles.iconText, { color: accent }]}>{icon}</Text>
      </View>

      <View style={styles.content}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        {!!message && <Text style={styles.message}>{message}</Text>}
      </View>

      <View style={styles.buttonRow}>
        {safeButtons.map((btn, idx) => {
          const isCancel = btn.style === "cancel"
          const isDestructive = btn.style === "destructive"
          const isPrimary =
            !isCancel && !isDestructive && idx === safeButtons.length - 1

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.button,
                isPrimary && { backgroundColor: accent },
                isDestructive && styles.buttonDestructive,
                isCancel && styles.buttonCancel,
              ]}
              onPress={() => {
                onDismiss()
                btn.onPress?.()
              }}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.buttonText,
                  isPrimary && styles.buttonTextPrimary,
                  isDestructive && styles.buttonTextDestructive,
                  isCancel && styles.buttonTextCancel,
                ]}
              >
                {btn.text}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </ModalSheet>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAlert(): UseAlertReturn {
  const [config, setConfig] = useState<AlertConfig>({
    visible: false,
    title: "",
    message: "",
    buttons: [{ text: "OK" }],
    type: "default",
  })

  const alert = useCallback(
    (
      title: string,
      message: string,
      buttons?: AlertButton[],
      type?: AlertType,
    ) => {
      setConfig({
        visible: true,
        title: title ?? "",
        message: message ?? "",
        buttons:
          Array.isArray(buttons) && buttons.length > 0
            ? buttons
            : [{ text: "OK" }],
        type: type ?? "default",
      })
    },
    [],
  )

  const dismiss = useCallback(() => {
    setConfig((prev) => ({ ...prev, visible: false }))
  }, [])

  const AlertComponent = (
    <CustomAlert
      visible={config.visible}
      title={config.title}
      message={config.message}
      buttons={config.buttons}
      type={config.type}
      onDismiss={dismiss}
    />
  )

  return { alert, AlertComponent }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (colors: any) =>
  StyleSheet.create({
    iconBadge: {
      alignSelf: "center",
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    iconText: { fontSize: 22, fontWeight: "700" },
    content: {
      paddingTop: 14,
      paddingBottom: 8,
      alignItems: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    message: {
      fontSize: 14.5,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 21,
    },
    buttonRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.separator,
      paddingTop: 14,
      marginTop: 4,
      gap: 8,
    },
    button: {
      flex: 1,
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: colors.separator,
    },
    buttonCancel: { backgroundColor: colors.separator },
    buttonDestructive: { backgroundColor: colors.errorLight },
    buttonText: { fontSize: 15, fontWeight: "600", color: "#374151" },
    buttonTextPrimary: { color: colors.surface },
    buttonTextDestructive: { color: colors.error },
    buttonTextCancel: { color: colors.textSecondary },
  })
