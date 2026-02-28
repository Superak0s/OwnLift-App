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

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickLogCreatineProps {
  visible: boolean
  onClose: () => void
  onLog: (grams: number, note: string) => void
  defaultGrams?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

const QUICK_AMOUNTS = [3, 5, 10] as const

export default function QuickLogCreatine({
  visible,
  onClose,
  onLog,
  defaultGrams = 5,
}: QuickLogCreatineProps) {
  const [grams, setGrams] = useState(String(defaultGrams))
  const [note, setNote] = useState("")
  const { alert, AlertComponent } = useAlert()

  const handleLog = () => {
    const amount = parseFloat(grams)
    if (isNaN(amount) || amount <= 0) {
      alert(
        "Invalid Amount",
        "Please enter a valid number of grams.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    onLog(amount, note)
    setNote("")
    onClose()
  }

  return (
    <ModalSheet visible={visible} onClose={onClose}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.icon}>💊</Text>
        <Text style={styles.title}>Log Creatine</Text>
        <Text style={styles.subtitle}>Quick entry</Text>
      </View>

      {/* Quick Amount Buttons */}
      <View style={styles.quickAmounts}>
        {QUICK_AMOUNTS.map((amount) => (
          <TouchableOpacity
            key={amount}
            style={[
              styles.quickButton,
              grams === String(amount) && styles.quickButtonActive,
            ]}
            onPress={() => setGrams(String(amount))}
          >
            <Text
              style={[
                styles.quickButtonText,
                grams === String(amount) && styles.quickButtonTextActive,
              ]}
            >
              {amount}g
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
            value={grams}
            onChangeText={setGrams}
            keyboardType='decimal-pad'
            placeholder='5'
            autoFocus
          />
          <Text style={styles.inputUnit}>grams</Text>
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

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: 24 },
  icon: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: "#333", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#999" },
  quickAmounts: { flexDirection: "row", gap: 12, marginBottom: 20 },
  quickButton: {
    flex: 1,
    backgroundColor: "#f9fafb",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  quickButtonActive: { backgroundColor: "#ede9fe", borderColor: "#8b5cf6" },
  quickButtonText: { fontSize: 16, fontWeight: "700", color: "#666" },
  quickButtonTextActive: { color: "#6d28d9" },
  inputSection: { marginBottom: 16 },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    paddingVertical: 14,
    color: "#333",
  },
  inputUnit: { fontSize: 16, color: "#999", fontWeight: "600" },
  noteInput: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minHeight: 60,
    textAlignVertical: "top",
  },
  buttons: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButtonText: { fontSize: 16, fontWeight: "700", color: "#666" },
  logButton: {
    flex: 1,
    backgroundColor: "#667eea",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logButtonText: { fontSize: 16, fontWeight: "700", color: "#fff" },
})
