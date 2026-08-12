import React, { useState, useCallback, useEffect, useMemo, useRef, type ReactElement } from "react"
import { useTheme } from "../context/ThemeContext"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import ModalSheet from "./ModalSheet"

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
  readonly visible: boolean
  readonly title: string
  readonly message: string
  readonly buttons: AlertButton[]
  readonly type: AlertType
  readonly onDismiss: () => void
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

const makeAccentColors = (colors: any): Record<AlertType, string> => ({
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
  info: colors.accent,
  lock: colors.textSecondary,
  session: colors.accent,
  default: colors.accent,
})

const ICON_BOX_SIZE = 38
const GLYPH_SIZE = 18

// Small hand-drawn glyph set instead of mixed emoji/unicode — keeps every
// alert type a single flat color that actually matches the accent, and
// gives the workout-session type a dumbbell instead of a stray 💪.
function AlertIcon({ type, color }: { type: AlertType; color: string }) {
  const box = {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
    position: "relative" as const,
  }
  const seg = (extra: object) => ({
    position: "absolute" as const,
    borderRadius: 1,
    backgroundColor: color,
    ...extra,
  })

  switch (type) {
    case "success":
      return (
        <View style={box}>
          <View
            style={seg({
              left: 2,
              top: 9,
              width: 7,
              height: 2.5,
              transform: [{ rotate: "45deg" }],
            })}
          />
          <View
            style={seg({
              left: 6,
              top: 2,
              width: 12,
              height: 2.5,
              transform: [{ rotate: "-52deg" }],
            })}
          />
        </View>
      )
    case "error":
      return (
        <View style={box}>
          <View
            style={seg({
              left: 2,
              top: 8,
              width: 14,
              height: 2.5,
              transform: [{ rotate: "45deg" }],
            })}
          />
          <View
            style={seg({
              left: 2,
              top: 8,
              width: 14,
              height: 2.5,
              transform: [{ rotate: "-45deg" }],
            })}
          />
        </View>
      )
    case "warning":
      return (
        <View style={box}>
          <View style={seg({ left: 8, top: 1, width: 2.5, height: 10 })} />
          <View style={seg({ left: 8, top: 14, width: 2.5, height: 2.5 })} />
        </View>
      )
    case "lock":
      return (
        <View style={box}>
          <View
            style={{
              position: "absolute",
              left: 4,
              top: 0,
              width: 10,
              height: 8,
              borderWidth: 2.5,
              borderColor: color,
              borderBottomWidth: 0,
              borderTopLeftRadius: 5,
              borderTopRightRadius: 5,
            }}
          />
          <View
            style={seg({
              left: 2,
              top: 7,
              width: 14,
              height: 10,
              borderRadius: 3,
            })}
          />
        </View>
      )
    case "session":
      return (
        <View style={box}>
          <View style={seg({ left: 4, top: 8, width: 10, height: 2.5 })} />
          <View
            style={seg({
              left: 0,
              top: 3,
              width: 4.5,
              height: 12,
              borderRadius: 2,
            })}
          />
          <View
            style={seg({
              left: 13.5,
              top: 3,
              width: 4.5,
              height: 12,
              borderRadius: 2,
            })}
          />
        </View>
      )
    case "info":
    default:
      return (
        <View style={box}>
          <View style={seg({ left: 8, top: 2, width: 2.5, height: 2.5 })} />
          <View style={seg({ left: 8, top: 7, width: 2.5, height: 9 })} />
        </View>
      )
  }
}

function CustomAlert({
  visible,
  title,
  message,
  buttons,
  type,
  onDismiss,
}: CustomAlertProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const ACCENT_COLORS = makeAccentColors(colors)
  const safeButtons =
    Array.isArray(buttons) && buttons.length > 0 ? buttons : [{ text: "OK" }]
  const safeType: AlertType = type ?? "default"
  const accent = ACCENT_COLORS[safeType]
  const stackButtons = safeButtons.length > 2
  const isHandlingPressRef = useRef(false)

  useEffect(() => {
    if (visible) isHandlingPressRef.current = false
  }, [visible])

  return (
    <ModalSheet
      visible={visible}
      onClose={onDismiss}
      showCancelButton={false}
      showConfirmButton={false}
      dismissOnBackdropPress={true}
    >
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: accent + "17" }]}>
          <AlertIcon type={safeType} color={accent} />
        </View>
        {!!title && (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        )}
      </View>

      {!!message && <Text style={styles.message}>{message}</Text>}

      <View style={[styles.buttonRow, stackButtons && styles.buttonColumn]}>
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
                stackButtons && styles.buttonFullWidth,
                isPrimary && { backgroundColor: accent },
                isDestructive && styles.buttonDestructive,
              ]}
              onPress={() => {
                if (isHandlingPressRef.current) return
                isHandlingPressRef.current = true
                onDismiss()
                btn.onPress?.()
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: colors.textPrimary },
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

const makeStyles = (colors: any) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingTop: 4,
    },
    iconBadge: {
      width: ICON_BOX_SIZE,
      height: ICON_BOX_SIZE,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      flex: 1,
      fontSize: 17,
      fontWeight: "700",
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    message: {
      fontSize: 14.5,
      color: colors.textSecondary,
      lineHeight: 21,
      marginTop: 10,
      marginLeft: ICON_BOX_SIZE + 12,
    },
    buttonRow: {
      flexDirection: "row",
      marginTop: 22,
      gap: 10,
    },
    buttonColumn: {
      flexDirection: "column",
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.separator,
    },
    buttonFullWidth: {
      flex: undefined,
      width: "100%",
    },
    buttonDestructive: {
      borderColor: colors.error + "55",
    },
    buttonText: { fontSize: 15, fontWeight: "600" },
    buttonTextPrimary: { color: colors.surface },
    buttonTextDestructive: { color: colors.error },
    buttonTextCancel: { color: colors.textSecondary },
  })
