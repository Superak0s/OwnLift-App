import React, { useRef, useEffect, useCallback, useMemo, type ReactNode } from "react"
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
import { useTheme } from "../context/ThemeContext"

interface ModalSheetHeaderActions {
  readonly title?: string
  readonly cancelText?: string
  readonly onCancel?: () => void
  readonly confirmText?: string
  readonly onConfirm?: () => void
  readonly confirmDisabled?: boolean
}

interface ModalSheetProps {
  readonly visible: boolean
  readonly onClose: () => void
  readonly title?: string
  readonly subtitle?: string
  readonly children?: ReactNode
  readonly showCancelButton?: boolean
  readonly showConfirmButton?: boolean
  readonly cancelText?: string
  readonly confirmText?: string
  readonly onConfirm?: () => void
  readonly confirmDisabled?: boolean
  readonly scrollable?: boolean
  readonly dismissOnBackdropPress?: boolean
  readonly fullHeight?: boolean
  /** Renders a top Cancel/title/Save row instead of the floating ✕ button — for full-height sheets that want their primary actions up top. */
  readonly headerActions?: ModalSheetHeaderActions
}

const KEYBOARD_DISMISS_DURATION_MS = 50

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
  headerActions,
}: ModalSheetProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
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

  const headerRow = headerActions ? (
    <View style={styles.headerRow}>
      <TouchableOpacity
        style={styles.headerRowBtn}
        onPress={headerActions.onCancel ?? safeClose}
      >
        <Text style={styles.headerRowCancelText}>
          {headerActions.cancelText ?? "Cancel"}
        </Text>
      </TouchableOpacity>
      <Text style={styles.headerRowTitle} numberOfLines={1}>
        {headerActions.title ?? title}
      </Text>
      {headerActions.onConfirm ? (
        <TouchableOpacity
          style={styles.headerRowBtn}
          onPress={headerActions.onConfirm}
          disabled={headerActions.confirmDisabled}
        >
          <Text
            style={[
              styles.headerRowConfirmText,
              headerActions.confirmDisabled && styles.headerRowConfirmDisabled,
            ]}
          >
            {headerActions.confirmText ?? "Save"}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerRowSpacer} />
      )}
    </View>
  ) : null

  const buttons =
    !headerActions && (showCancelButton || showConfirmButton) ? (
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
      animationType='slide'
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
          {headerActions ? (
            headerRow
          ) : (
            <>
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
            </>
          )}

          {scrollable ? (
            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={[
                styles.scrollBodyContent,
                { paddingBottom: bottomPad },
              ]}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps='handled'
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

const makeStyles = (colors: any) =>
  StyleSheet.create({
    fullScreen: { flex: 1 },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    sheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      maxHeight: "90%",
      backgroundColor: colors.surface,
      flexDirection: "column",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 20,
      shadowColor: colors.shadow,
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
      backgroundColor: colors.separator,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: "700",
      lineHeight: 18,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 4,
      textAlign: "center",
      paddingRight: 32,
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 16,
      textAlign: "center",
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginHorizontal: -20,
      marginTop: -20,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.inputBorder,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    headerRowBtn: { padding: 8, minWidth: 60 },
    headerRowCancelText: { fontSize: 16, color: colors.error, fontWeight: "600" },
    headerRowTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },
    headerRowConfirmText: {
      fontSize: 16,
      color: colors.accent,
      fontWeight: "600",
      textAlign: "right",
    },
    headerRowConfirmDisabled: { opacity: 0.4 },
    headerRowSpacer: { minWidth: 60 },
    staticBody: { marginTop: 8, flex: 1 },
    scrollBody: { marginTop: 8 },
    scrollBodyContent: { paddingBottom: 8 },
    modalButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
    modalButtonCancel: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.separator,
      alignItems: "center",
    },
    modalButtonTextCancel: {
      color: colors.textSecondary,
      fontWeight: "600",
      fontSize: 15,
    },
    modalButtonConfirm: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    modalButtonDisabled: { opacity: 0.5 },
    modalButtonTextConfirm: {
      color: colors.surface,
      fontWeight: "700",
      fontSize: 15,
    },
  })
