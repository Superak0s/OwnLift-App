// src/shared/components/widgets/WidgetGallery.tsx
//
// The "deploy screen" — pulled up from the top with a two-finger drag,
// same idea as Android's widget drawer. Lists every widget that isn't
// already placed and lets the user tap to add it.

import React from "react"
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native"
import { useTheme } from "@shared/context/ThemeContext"
import type { ThemeColors } from "@shared/context/ThemeContext"
import type { WidgetDefinition } from "@shared/types"

interface WidgetGalleryProps<T extends string> {
  visible: boolean
  onClose: () => void
  availableWidgets: WidgetDefinition<T>[]
  onAddWidget: (type: T) => void
  /** Whether any widgets are currently placed — hides the edit entry point
   *  when there's nothing to edit yet. */
  hasPlacedWidgets: boolean
  /** Closes this panel and switches the home screen into edit mode, where
   *  placed widgets can be resized, removed, or dragged to reorder. */
  onEditWidgets: () => void
}

export default function WidgetGallery<T extends string>({
  visible,
  onClose,
  availableWidgets,
  onAddWidget,
  hasPlacedWidgets,
  onEditWidgets,
}: WidgetGalleryProps<T>): React.JSX.Element {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const handleAdd = (type: T) => {
    onAddWidget(type)
  }

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Add a Widget</Text>
              <Text style={styles.subtitle}>
                Pull down with two fingers to open this anytime
              </Text>
            </View>
            <View style={styles.headerActions}>
              {hasPlacedWidgets && (
                <TouchableOpacity
                  onPress={onEditWidgets}
                  hitSlop={8}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>Edit Widgets</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {availableWidgets.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🎉</Text>
                <Text style={styles.emptyText}>
                  All widgets are already on your home screen
                </Text>
              </View>
            ) : (
              availableWidgets.map((def) => (
                <TouchableOpacity
                  key={def.type}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => handleAdd(def.type)}
                >
                  <Text style={styles.cardIcon}>{def.icon}</Text>
                  <Text style={styles.cardTitle}>{def.title}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {def.description}
                  </Text>
                  <View style={styles.addPill}>
                    <Text style={styles.addPillText}>+ Add</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
    },
    overlayTouchable: {
      flex: 1,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      maxHeight: "75%",
      paddingBottom: 24,
      paddingTop: 10,
    },
    grabber: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceBorder,
      marginBottom: 12,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    editButton: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginRight: 14,
    },
    editButtonText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.accent,
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      maxWidth: 260,
    },
    close: {
      fontSize: 22,
      color: colors.textSecondary,
    },
    grid: {
      paddingHorizontal: 16,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    card: {
      width: "48%",
      backgroundColor: colors.inputBackground,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    cardIcon: {
      fontSize: 26,
      marginBottom: 8,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    cardDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
      marginBottom: 10,
    },
    addPill: {
      alignSelf: "flex-start",
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    addPillText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: "700",
    },
    emptyState: {
      width: "100%",
      alignItems: "center",
      paddingVertical: 30,
    },
    emptyEmoji: {
      fontSize: 32,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
  })
