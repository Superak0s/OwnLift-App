import React, { useRef, useEffect, useCallback, type ReactNode } from "react"
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  Platform,
  Keyboard,
  Animated,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalSheetProps {
  visible: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children?: ReactNode
  showCancelButton?: boolean
  showConfirmButton?: boolean
  cancelText?: string
  confirmText?: string
  onConfirm?: () => void
  confirmDisabled?: boolean
  scrollable?: boolean
  dismissOnBackdropPress?: boolean
  fullHeight?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KEYBOARD_DISMISS_DURATION_MS = 50

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModalSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  showCancelButton = true,
  showConfirmButton = true,
  cancelText = "Cancel",
  confirmText = "Save",
  onConfirm,
  confirmDisabled = false,
  scrollable = false,
  dismissOnBackdropPress = true,
  fullHeight = false,
}: ModalSheetProps) {
  const insets = useSafeAreaInsets()
  const isKeyboardOpenRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sheetTranslateY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) sheetTranslateY.setValue(0)
  }, [visible])

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      isKeyboardOpenRef.current = true
      sheetTranslateY.setValue(-e.endCoordinates.height)
    })

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      isKeyboardOpenRef.current = false
      sheetTranslateY.setValue(0)
    })

    return () => {
      showSub.remove()
      hideSub.remove()
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!visible && closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [visible])

  const safeClose = useCallback(() => {
    if (Platform.OS === "android" && isKeyboardOpenRef.current) {
      Keyboard.dismiss()
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null
        onClose()
      }, KEYBOARD_DISMISS_DURATION_MS)
    } else {
      onClose()
    }
  }, [onClose])

  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 34)

  const buttons =
    showCancelButton || showConfirmButton ? (
      <View style={[styles.modalButtons, { paddingBottom: bottomPad }]}>
        {showCancelButton && (
          <TouchableOpacity
            style={styles.modalButtonCancel}
            onPress={safeClose}
          >
            <Text style={styles.modalButtonTextCancel}>{cancelText}</Text>
          </TouchableOpacity>
        )}
        {showConfirmButton && (
          <TouchableOpacity
            style={[
              styles.modalButtonConfirm,
              confirmDisabled && styles.modalButtonDisabled,
            ]}
            onPress={onConfirm}
            disabled={confirmDisabled}
          >
            <Text style={styles.modalButtonTextConfirm}>{confirmText}</Text>
          </TouchableOpacity>
        )}
      </View>
    ) : null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={safeClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <View style={styles.fullScreen}>
        <TouchableWithoutFeedback
          onPress={dismissOnBackdropPress ? safeClose : undefined}
        >
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheet,
            fullHeight && { height: "90%" },
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={safeClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {title ? <Text style={styles.modalTitle}>{title}</Text> : null}
          {subtitle ? (
            <Text style={styles.modalSubtitle}>{subtitle}</Text>
          ) : null}

          {scrollable ? (
            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={[
                styles.scrollBodyContent,
                { paddingBottom: bottomPad },
              ]}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {children}
              {buttons}
            </ScrollView>
          ) : (
            <>
              <View style={styles.staticBody}>{children}</View>
              {buttons}
              {!showCancelButton && !showConfirmButton && (
                <View style={{ height: bottomPad }} />
              )}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "90%",
    backgroundColor: "#fff",
    flexDirection: "column",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 12,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeButtonText: { fontSize: 16, color: "#666", fontWeight: "700", lineHeight: 18 },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
    textAlign: "center",
    paddingRight: 32,
  },
  modalSubtitle: { fontSize: 14, color: "#999", marginBottom: 16, textAlign: "center" },
  staticBody: { marginTop: 8, flex: 1 },
  scrollBody: { marginTop: 8 },
  scrollBodyContent: { paddingBottom: 8 },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalButtonCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  modalButtonTextCancel: { color: "#666", fontWeight: "600", fontSize: 15 },
  modalButtonConfirm: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#667eea",
    alignItems: "center",
  },
  modalButtonDisabled: { opacity: 0.5 },
  modalButtonTextConfirm: { color: "#fff", fontWeight: "700", fontSize: 15 },
})