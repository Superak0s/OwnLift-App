import React, { useState, useCallback, useEffect, useRef } from "react"
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native"

const ICONS = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i",
  lock: "🔒",
  session: "💪",
  default: "i",
}

const ACCENT_COLORS = {
  success: "#10b981",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#667eea",
  lock: "#6b7280",
  session: "#667eea",
  default: "#667eea",
}

// ─── Component ────────────────────────────────────────────────────────────────

function CustomAlert({ visible, title, message, buttons, type, onDismiss }) {
  const safeButtons =
    Array.isArray(buttons) && buttons.length > 0 ? buttons : [{ text: "OK" }]
  const safeType = type || "default"
  const accent = ACCENT_COLORS[safeType] || ACCENT_COLORS.default
  const icon = ICONS[safeType] || ICONS.default

  const scaleAnim = useRef(new Animated.Value(0.85)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      scaleAnim.setValue(0.85)
      opacityAnim.setValue(0)
    }
  }, [visible])

  return (
    <Modal
      visible={visible}
      transparent
      animationType='none'
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View
          style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
        >
          {/* Accent stripe */}
          <View style={[styles.accentStripe, { backgroundColor: accent }]} />

          {/* Icon badge */}
          <View style={[styles.iconBadge, { backgroundColor: accent + "22" }]}>
            <Text style={[styles.iconText, { color: accent }]}>{icon}</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {!!title && <Text style={styles.title}>{title}</Text>}
            {!!message && <Text style={styles.message}>{message}</Text>}
          </View>

          {/* Buttons — always a flex row so flex:1 on each button works */}
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
                    if (btn.onPress) btn.onPress()
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
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAlert() {
  const [config, setConfig] = useState({
    visible: false,
    title: "",
    message: "",
    buttons: [{ text: "OK" }],
    type: "default",
  })

  const alert = useCallback((title, message, buttons, type) => {
    setConfig({
      visible: true,
      title: title || "",
      message: message || "",
      buttons:
        Array.isArray(buttons) && buttons.length > 0
          ? buttons
          : [{ text: "OK" }],
      type: type || "default",
    })
  }, [])

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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  accentStripe: {
    height: 4,
    width: "100%",
  },
  iconBadge: {
    alignSelf: "center",
    marginTop: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 22,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14.5,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 21,
  },
  buttonRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    padding: 10,
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  buttonCancel: {
    backgroundColor: "#f3f4f6",
  },
  buttonDestructive: {
    backgroundColor: "#fef2f2",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  buttonTextPrimary: {
    color: "#ffffff",
  },
  buttonTextDestructive: {
    color: "#ef4444",
  },
  buttonTextCancel: {
    color: "#6b7280",
  },
})
