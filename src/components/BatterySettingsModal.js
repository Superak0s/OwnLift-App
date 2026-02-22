import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native"
import {
  getBatterySettings,
  saveBatterySettings,
  BATTERY_PRESETS,
  registerLocationTask,
} from "../../tasks/creatineLocationTask"
import ModalSheet from "../components/ModalSheet"
import { useAlert } from "../components/CustomAlert"

export default function BatterySettingsModal({ visible, onClose, onSave }) {
  const [selectedPreset, setSelectedPreset] = useState("MEDIUM")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customTimeInterval, setCustomTimeInterval] = useState("10")
  const [customDistanceInterval, setCustomDistanceInterval] = useState("250")
  const [loading, setLoading] = useState(true)
  const { alert, AlertComponent } = useAlert()

  useEffect(() => {
    if (visible) {
      loadSettings()
    }
  }, [visible])

  const loadSettings = async () => {
    try {
      const settings = await getBatterySettings()
      setSelectedPreset(settings.preset)

      if (settings.custom) {
        setShowAdvanced(true)
        setCustomTimeInterval(String(settings.timeInterval / 60000))
        setCustomDistanceInterval(String(settings.distanceInterval))
      }

      setLoading(false)
    } catch (error) {
      console.error("Error loading battery settings:", error)
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      let settings

      if (showAdvanced) {
        const timeMinutes = parseInt(customTimeInterval)
        const distanceMeters = parseInt(customDistanceInterval)

        if (isNaN(timeMinutes) || timeMinutes < 1 || timeMinutes > 60) {
          alert(
            "Invalid Input",
            "Time interval must be between 1 and 60 minutes",
            [{ text: "OK" }],
            "error",
          )
          return
        }

        if (
          isNaN(distanceMeters) ||
          distanceMeters < 50 ||
          distanceMeters > 1000
        ) {
          alert(
            "Invalid Input",
            "Distance interval must be between 50 and 1000 meters",
            [{ text: "OK" }],
            "error",
          )
          return
        }

        settings = await saveBatterySettings("CUSTOM", true, {
          timeInterval: timeMinutes * 60000,
          distanceInterval: distanceMeters,
          accuracy: 2,
        })
      } else {
        settings = await saveBatterySettings(selectedPreset)
      }

      await registerLocationTask()

      alert(
        "Settings Saved",
        "Battery impact settings updated. Location task has been restarted with new configuration.",
        [{ text: "OK" }],
        "success",
      )

      if (onSave) {
        onSave(settings)
      }

      onClose()
    } catch (error) {
      console.error("Error saving battery settings:", error)
      alert(
        "Error",
        "Failed to save battery settings",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      fullHeight={true}
      showCancelButton={false}
      showConfirmButton={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Battery Impact</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🔋</Text>
          <Text style={styles.infoTitle}>Configure Battery Usage</Text>
          <Text style={styles.infoText}>
            Choose how often the app checks your location in the background.
            More frequent checks = better accuracy but higher battery usage.
          </Text>
        </View>

        {/* Presets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Battery Presets</Text>

          {Object.entries(BATTERY_PRESETS).map(([key, preset]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.presetCard,
                selectedPreset === key && styles.presetCardActive,
              ]}
              onPress={() => {
                setSelectedPreset(key)
                setShowAdvanced(false)
              }}
            >
              <View style={styles.presetHeader}>
                <Text
                  style={[
                    styles.presetLabel,
                    selectedPreset === key && styles.presetLabelActive,
                  ]}
                >
                  {preset.label}
                </Text>
                {selectedPreset === key && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
              <Text style={styles.presetDescription}>{preset.description}</Text>
              <View style={styles.presetDetails}>
                <Text style={styles.presetDetail}>
                  ⏱️ Every {preset.timeInterval / 60000} min
                </Text>
                <Text style={styles.presetDetail}>
                  📏 {preset.distanceInterval}m movement
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Advanced Button */}
        <TouchableOpacity
          style={styles.advancedButton}
          onPress={() => {
            setShowAdvanced(!showAdvanced)
            if (!showAdvanced) {
              setSelectedPreset("CUSTOM")
            }
          }}
        >
          <Text style={styles.advancedIcon}>⚙️</Text>
          <Text style={styles.advancedText}>
            {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
          </Text>
        </TouchableOpacity>

        {/* Advanced Settings */}
        {showAdvanced && (
          <View style={styles.advancedSection}>
            <Text style={styles.sectionTitle}>Custom Settings</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Time Interval (minutes)</Text>
              <Text style={styles.inputHint}>How often to check location</Text>
              <TextInput
                style={styles.input}
                value={customTimeInterval}
                onChangeText={setCustomTimeInterval}
                keyboardType='number-pad'
                placeholder='10'
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Distance Interval (meters)</Text>
              <Text style={styles.inputHint}>Check when moved this far</Text>
              <TextInput
                style={styles.input}
                value={customDistanceInterval}
                onChangeText={setCustomDistanceInterval}
                keyboardType='number-pad'
                placeholder='250'
              />
            </View>

            <View style={styles.warningCard}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>
                Very frequent checks ({"<"}5 min) or small distances ({"<"}
                100m) may significantly impact battery life.
              </Text>
            </View>
          </View>
        )}

        {/* Recommendations */}
        <View style={styles.recommendationsCard}>
          <Text style={styles.recommendationsTitle}>💡 Recommendations</Text>
          <Text style={styles.recommendationItem}>
            • <Text style={styles.bold}>Low Impact</Text>: Best for all-day
            battery life
          </Text>
          <Text style={styles.recommendationItem}>
            • <Text style={styles.bold}>Medium Impact</Text>: Balanced
            (recommended)
          </Text>
          <Text style={styles.recommendationItem}>
            • <Text style={styles.bold}>High Impact</Text>: Most accurate,
            higher battery use
          </Text>
        </View>
      </ScrollView>

      {AlertComponent}
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerButton: { padding: 8 },
  cancelText: { fontSize: 16, color: "#ef4444", fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#333" },
  saveText: { fontSize: 16, color: "#667eea", fontWeight: "600" },
  content: { flex: 1 },
  contentContainer: { padding: 20 },
  infoCard: {
    backgroundColor: "#e8eaf6",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  infoIcon: { fontSize: 48, marginBottom: 12 },
  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  presetCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  presetCardActive: {
    borderColor: "#667eea",
    backgroundColor: "#f0f4ff",
  },
  presetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  presetLabel: { fontSize: 16, fontWeight: "700", color: "#333" },
  presetLabelActive: { color: "#667eea" },
  checkmark: { fontSize: 20, color: "#667eea", fontWeight: "700" },
  presetDescription: { fontSize: 14, color: "#666", marginBottom: 12 },
  presetDetails: { flexDirection: "row", gap: 16 },
  presetDetail: { fontSize: 13, color: "#999" },
  advancedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  advancedIcon: { fontSize: 20, marginRight: 8 },
  advancedText: { fontSize: 15, fontWeight: "600", color: "#667eea" },
  advancedSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  inputHint: { fontSize: 12, color: "#999", marginBottom: 8 },
  input: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  warningCard: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  warningIcon: { fontSize: 20, marginRight: 8 },
  warningText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 18 },
  recommendationsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  recommendationsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  recommendationItem: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: { fontWeight: "700", color: "#333" },
})
