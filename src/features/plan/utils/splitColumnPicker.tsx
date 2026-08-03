import React from "react"
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native"
import type { ThemeColors } from "@shared/context/ThemeContext"
import type { SplitColumnCandidate } from "@utils/clientWorkoutParser"

interface SplitColumnPickerProps {
  visible: boolean
  fileName?: string | null
  candidates: SplitColumnCandidate[]
  selectedIndices: Set<number>
  onToggle: (index: number) => void
  onSelectAll: () => void
  onSelectNone: () => void
  onCancel: () => void
  onConfirm: () => void
  isImporting?: boolean
  colors: ThemeColors
}

export default function SplitColumnPicker({
  visible,
  fileName,
  candidates,
  selectedIndices,
  onToggle,
  onSelectAll,
  onSelectNone,
  onCancel,
  onConfirm,
  isImporting = false,
  colors,
}: SplitColumnPickerProps): React.JSX.Element {
  const styles = makeStyles(colors)
  const selectedCount = selectedIndices.size

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Which columns are splits?</Text>
          <Text style={styles.subtitle}>
            {fileName
              ? `We found these columns in "${fileName}". Pick the ones that represent a person/split — anything else (notes, summaries, etc.) will be left out.`
              : "Pick the columns that represent a person/split. Anything else (notes, summaries, etc.) will be left out."}
          </Text>

          {candidates.length === 0 ? (
            <Text style={styles.emptyText}>
              No candidate columns were found after the first "Day" row's
              header, so there's nothing to pick from.
            </Text>
          ) : (
            <>
              <View style={styles.quickActionsRow}>
                <TouchableOpacity onPress={onSelectAll}>
                  <Text style={styles.quickActionText}>Select all</Text>
                </TouchableOpacity>
                <Text style={styles.quickActionSep}>·</Text>
                <TouchableOpacity onPress={onSelectNone}>
                  <Text style={styles.quickActionText}>Select none</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps='handled'
              >
                {candidates.map((c) => {
                  const isSelected = selectedIndices.has(c.index)
                  return (
                    <TouchableOpacity
                      key={c.index}
                      style={styles.row}
                      onPress={() => onToggle(c.index)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxChecked,
                        ]}
                      >
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={styles.rowTextWrap}>
                        <Text style={styles.rowLabel}>{c.name}</Text>
                        <Text style={styles.rowMeta}>
                          Column {c.index + 1}
                          {c.autoSelected ? " · suggested" : ""}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={isImporting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (selectedCount === 0 || isImporting) &&
                  styles.confirmBtnDisabled,
              ]}
              onPress={onConfirm}
              disabled={selectedCount === 0 || isImporting}
            >
              <Text style={styles.confirmBtnText}>
                {isImporting
                  ? "Importing…"
                  : `Import ${selectedCount || ""} split${
                      selectedCount === 1 ? "" : "s"
                    }`.trim()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: "80%",
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 14,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      fontStyle: "italic",
      paddingVertical: 12,
    },
    quickActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    quickActionText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },
    quickActionSep: {
      marginHorizontal: 8,
      color: colors.textMuted,
    },
    list: {
      maxHeight: 320,
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    checkboxChecked: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    checkmark: {
      color: colors.surface,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 14,
    },
    rowTextWrap: { flex: 1 },
    rowLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    rowMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    cancelBtn: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
      backgroundColor: colors.separator,
    },
    cancelBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    confirmBtn: {
      flex: 2,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
      backgroundColor: colors.accent,
    },
    confirmBtnDisabled: {
      opacity: 0.5,
    },
    confirmBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.surface,
    },
  })
