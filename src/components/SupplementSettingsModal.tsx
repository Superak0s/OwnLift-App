/**
 * SupplementSettingsModal
 *
 * A full-height modal that lets the user configure reminder settings for any
 * supplement: time-based, location-based, default amount, and notification type.
 *
 * This is the generalized version of the old "Creatine Reminders" modal that
 * used to live inside SettingsScreen. It is now opened from the SupplementsScreen
 * per-supplement card, so every supplement can have its own reminder settings.
 */
import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import DateTimePicker from "@react-native-community/datetimepicker"
import * as Location from "expo-location"
import AsyncStorage from "@react-native-async-storage/async-storage"

import type { SupplementSummary } from "../services/api"
import { supplementsApi } from "../services/api"
import {
  scheduleTimeReminder,
  cancelTimeReminder,
  saveSupplementReminderConfig, // replaces clearAllReminderKeys
  registerLocationTask,
  unregisterLocationTask,
  isLocationTaskRegistered,
  initializeSupplementNotifications, // replaces initializeCreatineNotifications
  triggerImmediateLocationCheck,
  getBatterySettings,
  BATTERY_PRESETS,
} from "../../tasks/supplementLocationTask"
import CreatineLocationPicker, {
  type SelectedLocation,
} from "./Supplementlocationpicker"
import BatterySettingsModal from "./BatterySettingsModal"
import ModalSheet from "./ModalSheet"
import { useAlert } from "./CustomAlert"
import { useTheme } from "../context/ThemeContext"
import { useAuth } from "../context/AuthContext"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplementSettingsModalProps {
  visible: boolean
  supplement: SupplementSummary
  onClose: () => void
  onSaved: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupplementSettingsModal({
  visible,
  supplement,
  onClose,
  onSaved,
}: SupplementSettingsModalProps): React.JSX.Element | null {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { alert, AlertComponent } = useAlert()
  const { user } = useAuth()

  const [timeBasedEnabled, setTimeBasedEnabled] = useState(false)
  const [locationBasedEnabled, setLocationBasedEnabled] = useState(false)
  const [reminderTime, setReminderTime] = useState(new Date())
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [defaultAmount, setDefaultAmount] = useState(
    String(supplement.defaultAmount),
  )
  const [notificationType, setNotificationType] = useState("notification")
  const [reminderLocation, setReminderLocation] =
    useState<SelectedLocation | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [showBatterySettings, setShowBatterySettings] = useState(false)
  const [batteryPreset, setBatteryPreset] = useState("MEDIUM")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // ── Load settings on open ─────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) return
    void loadSettings()
  }, [visible, supplement.id])

  const settingsKey = (uid: string | number) =>
    `supplementSettings_${supplement.id}_user_${uid}`

  const loadSettings = async () => {
    setLoading(true)
    try {
      // 1. Try supplement-specific AsyncStorage key
      if (user?.id) {
        const raw = await AsyncStorage.getItem(settingsKey(user.id))
        if (raw) {
          const s = JSON.parse(raw)
          setTimeBasedEnabled(s.timeBasedEnabled || false)
          setLocationBasedEnabled(s.locationBasedReminder || false)
          setDefaultAmount(String(s.defaultAmount || supplement.defaultAmount))
          setNotificationType(s.notificationType || "notification")
          if (s.reminderLocation) setReminderLocation(s.reminderLocation)
          if (s.reminderTime) {
            const [h, m] = s.reminderTime.split(":")
            const d = new Date()
            d.setHours(parseInt(h, 10))
            d.setMinutes(parseInt(m, 10))
            setReminderTime(d)
          }
        }
      }

      // 2. Supplement API — fetch location
      try {
        const locRes = await supplementsApi.getLocation(supplement.id)
        if (locRes.location) {
          setReminderLocation({
            lat: locRes.location.latitude,
            lng: locRes.location.longitude,
            address: locRes.location.address,
            radius: locRes.location.radius,
          })
          setLocationBasedEnabled(locRes.enabled)
        }
      } catch {
        // location not set — fine
      }

      // 3. Battery preset
      const bat = await getBatterySettings()
      setBatteryPreset(bat.preset)
    } catch (err) {
      console.error("Error loading supplement settings:", err)
    } finally {
      setLoading(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!timeBasedEnabled && !locationBasedEnabled) {
      alert(
        "Enable a Condition",
        "Please enable at least one reminder type (time or location).",
        [{ text: "OK" }],
        "warning",
      )
      return
    }

    if (locationBasedEnabled && !reminderLocation) {
      alert(
        "Set Location",
        "Please pick a location before enabling location-based reminders.",
        [{ text: "OK" }],
        "warning",
      )
      return
    }

    const amt = parseFloat(defaultAmount)
    if (isNaN(amt) || amt <= 0) {
      alert(
        "Invalid Amount",
        "Please enter a valid default amount.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    const notifReady = await initializeSupplementNotifications()
    if (!notifReady) {
      alert(
        "Notifications Required",
        "Please enable notifications for reminders to work.",
        [{ text: "OK" }],
        "warning",
      )
      return
    }

    if (locationBasedEnabled) {
      const { status: fg } = await Location.requestForegroundPermissionsAsync()
      if (fg !== "granted") {
        alert(
          "Permission Required",
          "Location access is needed for location-based reminders.",
          [{ text: "OK" }],
          "warning",
        )
        return
      }
      if (Platform.OS === "android") {
        const { status: bg } =
          await Location.requestBackgroundPermissionsAsync()
        if (bg !== "granted") {
          alert(
            "Background Permission Required",
            "Background location is needed for reminders to work when the app is closed.\n\nSelect 'Allow all the time' in Settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
            "warning",
          )
          return
        }
      }
    }

    setSaving(true)
    try {
      const timeStr = `${reminderTime.getHours().toString().padStart(2, "0")}:${reminderTime.getMinutes().toString().padStart(2, "0")}`

      // Update supplement default amount
      await supplementsApi.update(supplement.id, { defaultAmount: amt })

      // Save location if set
      if (reminderLocation) {
        await supplementsApi.saveLocation(supplement.id, {
          latitude: reminderLocation.lat,
          longitude: reminderLocation.lng,
          address: reminderLocation.address,
          radius: reminderLocation.radius,
        })
        await supplementsApi.toggleLocation(supplement.id, locationBasedEnabled)
      }

      // Update supplement reminder flag
      await supplementsApi.update(supplement.id, {
        reminderEnabled: timeBasedEnabled || locationBasedEnabled,
        reminderTime: timeBasedEnabled ? timeStr : null,
        locationReminderEnabled: locationBasedEnabled,
      })

      // Persist locally and save the reminder config for the background task
      if (user?.id) {
        const stored = {
          timeBasedEnabled,
          locationBasedReminder: locationBasedEnabled,
          reminderLocation,
          reminderTime: timeStr,
          defaultAmount: amt,
          notificationType,
        }
        await AsyncStorage.setItem(settingsKey(user.id), JSON.stringify(stored))

        // Save config so the background location task can evaluate this supplement
        await saveSupplementReminderConfig(String(user.id), {
          supplementId: supplement.id,
          name: supplement.name,
          unit: supplement.unit,
          defaultAmount: amt,
          locationBasedReminder: locationBasedEnabled,
          timeBasedEnabled,
          reminderTime: timeStr,
          reminderLocation: reminderLocation
            ? {
                lat: reminderLocation.lat,
                lng: reminderLocation.lng,
                address: reminderLocation.address,
                radius: reminderLocation.radius,
              }
            : null,
          enabled: true,
        })
      }

      // Schedule / register
      if (timeBasedEnabled && !locationBasedEnabled) {
        await cancelTimeReminder(supplement.id)
        const isReg = await isLocationTaskRegistered()
        if (isReg) await unregisterLocationTask()
        const identifier = await scheduleTimeReminder(
          String(user!.id),
          supplement.id,
          supplement.name,
          amt,
          supplement.unit,
          timeStr,
        )
        if (!identifier) {
          alert(
            "Warning",
            "Could not schedule the time-based notification. Please try again.",
            [{ text: "OK" }],
            "warning",
          )
        }
      } else if (locationBasedEnabled) {
        await cancelTimeReminder(supplement.id)
        const registered = await registerLocationTask()
        if (!registered) {
          alert(
            "Warning",
            "Location tracking may not work properly. Check permissions.",
            [{ text: "OK" }],
            "warning",
          )
        } else {
          await triggerImmediateLocationCheck()
        }
      }

      let msg = `${supplement.name} reminder settings saved!`
      if (timeBasedEnabled && !locationBasedEnabled)
        msg += ` You'll be reminded daily at ${timeStr}.`
      else if (locationBasedEnabled && !timeBasedEnabled)
        msg += ` You'll be reminded when you arrive at ${reminderLocation?.address || "your location"}.`
      else
        msg += ` You'll be reminded at ${timeStr} when you're at ${reminderLocation?.address || "your location"}.`

      alert("✅ Saved", msg, [{ text: "OK" }], "success")
      onSaved()
    } catch (err) {
      alert(
        "Error",
        err instanceof Error ? err.message : "Failed to save settings",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Disable all reminders ─────────────────────────────────────────────────

  const handleDisable = async () => {
    alert(
      "Disable Reminders",
      `Turn off all reminders for ${supplement.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disable",
          style: "destructive",
          onPress: async () => {
            try {
              await supplementsApi.update(supplement.id, {
                reminderEnabled: false,
                reminderTime: null,
                locationReminderEnabled: false,
              })
              if (reminderLocation) {
                await supplementsApi.toggleLocation(supplement.id, false)
              }
              await cancelTimeReminder(supplement.id)
              const isReg = await isLocationTaskRegistered()
              if (isReg) await unregisterLocationTask()
              if (user?.id) {
                await AsyncStorage.removeItem(settingsKey(user.id))
                // Mark config as disabled in the background task store
                await saveSupplementReminderConfig(String(user.id), {
                  supplementId: supplement.id,
                  name: supplement.name,
                  unit: supplement.unit,
                  defaultAmount:
                    parseFloat(defaultAmount) || supplement.defaultAmount,
                  locationBasedReminder: false,
                  timeBasedEnabled: false,
                  reminderTime: "00:00",
                  reminderLocation: null,
                  enabled: false,
                })
              }
              setTimeBasedEnabled(false)
              setLocationBasedEnabled(false)
              alert(
                "Reminders Disabled",
                `Reminders for ${supplement.name} have been turned off.`,
                [{ text: "OK" }],
                "success",
              )
              onSaved()
            } catch (err) {
              alert(
                "Error",
                err instanceof Error ? err.message : "Failed",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "warning",
    )
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTimeChange = (_event: unknown, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === "ios")
    if (selectedDate) setReminderTime(selectedDate)
  }

  if (!visible) return null

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      fullHeight={true}
      showCancelButton={false}
      showConfirmButton={false}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {supplement.icon || "💊"} {supplement.name}
          </Text>
          <View style={{ width: 64 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color={colors.accent} />
          </View>
        ) : (
          <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Hero info card */}
              <View style={styles.heroBanner}>
                <Text style={styles.heroIcon}>{supplement.icon || "💊"}</Text>
                <Text style={styles.heroTitle}>Reminder Settings</Text>
                <Text style={styles.heroSubtitle}>
                  Set up time or location-based reminders so you never miss a
                  dose of {supplement.name}.
                </Text>
              </View>

              {/* Default amount */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Default Amount</Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={defaultAmount}
                    onChangeText={setDefaultAmount}
                    keyboardType='decimal-pad'
                    placeholder={String(supplement.defaultAmount)}
                  />
                  <View style={styles.amountUnit}>
                    <Text style={styles.amountUnitText}>{supplement.unit}</Text>
                  </View>
                </View>
              </View>

              {/* Time-based reminder */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionIcon}>🕐</Text>
                    <View>
                      <Text style={styles.sectionTitle}>
                        Time-Based Reminder
                      </Text>
                      <Text style={styles.sectionSubtitle}>
                        Remind daily at a specific time
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={timeBasedEnabled}
                    onValueChange={setTimeBasedEnabled}
                    trackColor={{
                      false: colors.surfaceBorder,
                      true: colors.accent,
                    }}
                    thumbColor='#fff'
                  />
                </View>

                {timeBasedEnabled && (
                  <View style={styles.sectionBody}>
                    <TouchableOpacity
                      style={styles.timeBtn}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Text style={styles.timeBtnLabel}>Reminder Time</Text>
                      <Text style={styles.timeBtnValue}>
                        {reminderTime.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </TouchableOpacity>
                    {showTimePicker && (
                      <DateTimePicker
                        value={reminderTime}
                        mode='time'
                        is24Hour
                        display='default'
                        onChange={handleTimeChange}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Location-based reminder */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionIcon}>📍</Text>
                    <View>
                      <Text style={styles.sectionTitle}>
                        Location-Based Reminder
                      </Text>
                      <Text style={styles.sectionSubtitle}>
                        Remind when you arrive at a place
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={locationBasedEnabled}
                    onValueChange={setLocationBasedEnabled}
                    trackColor={{
                      false: colors.surfaceBorder,
                      true: colors.accent,
                    }}
                    thumbColor='#fff'
                  />
                </View>

                {locationBasedEnabled && (
                  <View style={styles.sectionBody}>
                    <TouchableOpacity
                      style={styles.locationBtn}
                      onPress={() => setShowLocationPicker(true)}
                    >
                      <Text style={styles.locationBtnLabel}>
                        {reminderLocation
                          ? `📍 ${reminderLocation.address}`
                          : "Tap to set a reminder location"}
                      </Text>
                    </TouchableOpacity>

                    {locationBasedEnabled && (
                      <TouchableOpacity
                        style={styles.batteryBtn}
                        onPress={() => setShowBatterySettings(true)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.batteryBtnLabel}>
                            Battery Impact
                          </Text>
                          <Text style={styles.batteryBtnValue}>
                            {BATTERY_PRESETS[
                              batteryPreset as keyof typeof BATTERY_PRESETS
                            ]?.label || "Medium Impact"}
                            {" — "}
                            {BATTERY_PRESETS[
                              batteryPreset as keyof typeof BATTERY_PRESETS
                            ]?.description || "Checks every 10 min"}
                          </Text>
                        </View>
                        <Text style={styles.batteryBtnArrow}>⚙️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Notification type */}
              {(timeBasedEnabled || locationBasedEnabled) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Notification Type</Text>
                  <View style={styles.notifRow}>
                    {[
                      {
                        key: "notification",
                        icon: "🔔",
                        label: "Notification",
                        desc: "Standard alert",
                      },
                      {
                        key: "alarm",
                        icon: "⏰",
                        label: "Alarm",
                        desc: "Louder alert",
                      },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.notifOption,
                          notificationType === opt.key &&
                            styles.notifOptionActive,
                        ]}
                        onPress={() => setNotificationType(opt.key)}
                      >
                        <Text style={styles.notifIcon}>{opt.icon}</Text>
                        <Text
                          style={[
                            styles.notifLabel,
                            notificationType === opt.key &&
                              styles.notifLabelActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <Text style={styles.notifDesc}>{opt.desc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Summary card */}
              {(timeBasedEnabled || locationBasedEnabled) && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>📋 Summary</Text>
                  <Text style={styles.summaryText}>
                    {timeBasedEnabled && !locationBasedEnabled
                      ? `You'll be reminded to take ${supplement.name} daily at ${reminderTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
                      : !timeBasedEnabled && locationBasedEnabled
                        ? `You'll be reminded when you arrive at ${reminderLocation?.address || "your set location"}.`
                        : `You'll be reminded at ${reminderTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} when you're at ${reminderLocation?.address || "your set location"}.`}
                  </Text>
                </View>
              )}

              {/* Disable reminders */}
              {supplement.reminderEnabled && (
                <TouchableOpacity
                  style={styles.disableBtn}
                  onPress={handleDisable}
                >
                  <Text style={styles.disableBtnText}>
                    Turn off all reminders
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Footer save button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color='#fff' />
                ) : (
                  <Text style={styles.saveBtnText}>✓ Save Settings</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Sub-modals */}
        <CreatineLocationPicker
          visible={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          onLocationSelected={async (loc) => {
            setReminderLocation(loc)
            try {
              await supplementsApi.saveLocation(supplement.id, {
                latitude: loc.lat,
                longitude: loc.lng,
                address: loc.address,
                radius: loc.radius,
              })
              alert(
                "Location Set",
                `Location saved: ${loc.address}`,
                [{ text: "OK" }],
                "success",
              )
            } catch (err) {
              alert(
                "Error",
                "Failed to save location",
                [{ text: "OK" }],
                "error",
              )
            }
          }}
          initialLocation={reminderLocation}
        />

        <BatterySettingsModal
          visible={showBatterySettings}
          onClose={() => setShowBatterySettings(false)}
          onSave={(settings) => setBatteryPreset(settings.preset)}
        />

        {AlertComponent}
      </SafeAreaView>
    </ModalSheet>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (colors: any) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    headerBtn: { padding: 6 },
    headerBtnText: {
      fontSize: 16,
      color: colors.error,
      fontWeight: "600",
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.textPrimary,
      flex: 1,
      textAlign: "center",
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    content: { padding: 20, paddingBottom: 20 },

    heroBanner: {
      backgroundColor: colors.infoLight,
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      marginBottom: 24,
    },
    heroIcon: { fontSize: 48, marginBottom: 10 },
    heroTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    heroSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },

    section: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 12,
    },
    sectionIcon: { fontSize: 24 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    sectionBody: { marginTop: 16, gap: 12 },

    amountRow: {
      flexDirection: "row",
      marginTop: 10,
      gap: 10,
      alignItems: "center",
    },
    amountInput: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    amountUnit: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    amountUnitText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textMuted,
    },

    timeBtn: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.accent,
    },
    timeBtnLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    timeBtnValue: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.accent,
    },

    locationBtn: {
      backgroundColor: "#f0f9ff",
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: "#0ea5e9",
    },
    locationBtnLabel: {
      fontSize: 14,
      color: "#0c4a6e",
      fontWeight: "600",
    },

    batteryBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    batteryBtnLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    batteryBtnValue: {
      fontSize: 12,
      color: colors.textMuted,
    },
    batteryBtnArrow: { fontSize: 20 },

    notifRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 10,
    },
    notifOption: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 14,
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.inputBorder,
    },
    notifOptionActive: {
      backgroundColor: colors.infoLight,
      borderColor: "#8b5cf6",
    },
    notifIcon: { fontSize: 28, marginBottom: 6 },
    notifLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textSecondary,
      marginBottom: 3,
    },
    notifLabelActive: { color: "#6d28d9" },
    notifDesc: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center",
    },

    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.accent,
      marginBottom: 14,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    summaryText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    disableBtn: {
      padding: 16,
      alignItems: "center",
      marginBottom: 8,
    },
    disableBtnText: {
      fontSize: 15,
      color: colors.error,
      fontWeight: "600",
    },

    footer: {
      padding: 20,
      paddingBottom: Platform.OS === "ios" ? 34 : 20,
      borderTopWidth: 1,
      borderTopColor: colors.inputBorder,
      backgroundColor: colors.surface,
    },
    saveBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    saveBtnText: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.surface,
    },
  })
