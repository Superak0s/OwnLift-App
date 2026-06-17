import React, { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native"
import ModalSheet from "./ModalSheet"
import { useAlert } from "./CustomAlert"
import { useTheme } from "../context/ThemeContext"

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickLogSupplementProps {
  visible: boolean
  onClose: () => void
  onLog: (amount: number, note: string) => void
  /** Display name of the supplement, e.g. "Creatine" */
  supplementName?: string
  /** Unit label shown next to the input, e.g. "grams" or "mg" */
  unit?: string
  /** Icon emoji shown in the header */
  icon?: string
  /** Pre-selected amount when the sheet opens */
  defaultAmount?: number
  /** Quick-pick amounts shown as buttons */
  quickAmounts?: readonly number[]
}

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_QUICK_AMOUNTS = [3, 5, 10] as const

export default function QuickLogSupplement({
  visible,
  onClose,
  onLog,
  supplementName = "Supplement",
  unit = "grams",
  icon = "💊",
  defaultAmount = 5,
  quickAmounts = DEFAULT_QUICK_AMOUNTS,
}: QuickLogSupplementProps) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [amount, setAmount] = useState(String(defaultAmount))
  const [note, setNote] = useState("")
  const { alert, AlertComponent } = useAlert()

  const handleLog = () => {
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      alert(
        "Invalid Amount",
        "Please enter a valid amount.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    onLog(parsed, note)
    setNote("")
    onClose()
  }

  return (
    <ModalSheet visible={visible} onClose={onClose}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>Log {supplementName}</Text>
        <Text style={styles.subtitle}>Quick entry</Text>
      </View>

      {/* Quick Amount Buttons */}
      <View style={styles.quickAmounts}>
        {quickAmounts.map((q) => (
          <TouchableOpacity
            key={q}
            style={[
              styles.quickButton,
              amount === String(q) && styles.quickButtonActive,
            ]}
            onPress={() => setAmount(String(q))}
          >
            <Text
              style={[
                styles.quickButtonText,
                amount === String(q) && styles.quickButtonTextActive,
              ]}
            >
              {q}
              {unit === "grams" ? "g" : unit}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom Amount */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Amount</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType='decimal-pad'
            placeholder={String(defaultAmount)}
            autoFocus
          />
          <Text style={styles.inputUnit}>{unit}</Text>
        </View>
      </View>

      {/* Optional Note */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Note (optional)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder='e.g., with breakfast'
          multiline
        />
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logButton} onPress={handleLog}>
          <Text style={styles.logButtonText}>✓ Log Entry</Text>
        </TouchableOpacity>
      </View>

      {AlertComponent}
    </ModalSheet>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (colors: any) =>
  StyleSheet.create({
    header: { alignItems: "center", marginBottom: 24 },
    icon: { fontSize: 48, marginBottom: 8 },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    subtitle: { fontSize: 14, color: colors.textMuted },
    quickAmounts: { flexDirection: "row", gap: 12, marginBottom: 20 },
    quickButton: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.inputBorder,
    },
    quickButtonActive: {
      backgroundColor: colors.infoLight,
      borderColor: "#8b5cf6",
    },
    quickButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    quickButtonTextActive: { color: "#6d28d9" },
    inputSection: { marginBottom: 16 },
    inputLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    input: {
      flex: 1,
      fontSize: 24,
      fontWeight: "700",
      paddingVertical: 14,
      color: colors.textPrimary,
    },
    inputUnit: { fontSize: 16, color: colors.textMuted, fontWeight: "600" },
    noteInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 14,
      fontSize: 14,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      minHeight: 60,
      textAlignVertical: "top",
    },
    buttons: { flexDirection: "row", gap: 12, marginTop: 8 },
    cancelButton: {
      flex: 1,
      backgroundColor: colors.separator,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    logButton: {
      flex: 1,
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    logButtonText: { fontSize: 16, fontWeight: "700", color: colors.surface },
  })
