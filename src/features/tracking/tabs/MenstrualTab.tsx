import { STORAGE_KEYS } from "@shared/services/storage";
import type { WidgetDefinition, WidgetInstance } from "@shared/types";


export type MenstrualWidgetType =
  | "menstrual_overview"
  | "menstrual_calendar"
  | "menstrual_cycle"
  | "menstrual_history";

export const MENSTRUAL_WIDGET_REGISTRY: Record<
  MenstrualWidgetType,
  WidgetDefinition<MenstrualWidgetType>
> = {
  menstrual_overview: {
    type: "menstrual_overview",
    title: "Cycle Status",
    description: "Current cycle phase and estimated next period",
    icon: "🩸",
    availableSizes: ["small", "medium"],
    defaultSize: "medium",
    singleton: true,
  },
  menstrual_calendar: {
    type: "menstrual_calendar",
    title: "Cycle Calendar",
    description: "Calendar view of your menstrual cycle",
    icon: "📅",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  menstrual_cycle: {
    type: "menstrual_cycle",
    title: "Cycle Details",
    description: "Current cycle length and phase information",
    icon: "📊",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  menstrual_history: {
    type: "menstrual_history",
    title: "Cycle History",
    description: "Your recent menstrual cycle entries",
    icon: "📋",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
};

export const DEFAULT_MENSTRUAL_WIDGETS: WidgetInstance<MenstrualWidgetType>[] =
  [
    {
      id: "default-menstrual-overview",
      type: "menstrual_overview",
      size: "medium",
      order: 0,
    },
    {
      id: "default-menstrual-calendar",
      type: "menstrual_calendar",
      size: "large",
      order: 1,
    },
    {
      id: "default-menstrual-cycle",
      type: "menstrual_cycle",
      size: "medium",
      order: 2,
    },
    {
      id: "default-menstrual-history",
      type: "menstrual_history",
      size: "medium",
      order: 3,
    },
  ];

export const MENSTRUAL_WIDGETS_STORAGE_KEY = STORAGE_KEYS.MENSTRUAL_TAB_WIDGETS;


export const MENSTRUAL_TAB_CONFIG = {
  key: "menstrual",
  icon: "🩸",
  label: "Cycle",
};


import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useTheme } from "@shared/context/ThemeContext";
import ModalSheet from "@shared/components/ModalSheet";
import { menstrualApi } from "../services";
import { buildLocalISOForDate } from "../utils";

export const FLOW_INTENSITY_OPTIONS = ["light", "moderate", "heavy"] as const;

export const FLOW_INTENSITY_LABELS: Record<string, string> = {
  light: "Light",
  moderate: "Moderate",
  heavy: "Heavy",
};

interface LogCycleModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly prefillDate?: Date;
  readonly onSuccess?: (data: any) => void;
}

export function LogCycleModal({
  visible,
  onClose,
  prefillDate,
  onSuccess,
}: LogCycleModalProps) {
  const { colors } = useTheme();
  const [settings, setSettings] = useState<{
    periodDays: number;
    cycleLengthDays: number;
  } | null>(null);
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const styles = makeLogCycleStyles(colors);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    try {
      const response = await menstrualApi.getSettings();
      if (response.success && response.data) {
        setSettings(response.data);
      }
    } catch (err) {
      console.error("Failed to load menstrual settings:", err);
    }
  };

  const handleLog = async () => {
    try {
      setLoading(true);
      setError("");

      const cycleStart = prefillDate || new Date();
      const cycleStartIso = buildLocalISOForDate(cycleStart);

      await menstrualApi.logMenstrualCycle(
        cycleStartIso,
        "moderate",
        note ? [note] : undefined,
      );

      setNote("");
      onClose();
      onSuccess?.({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log cycle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title='Log Period Start'
      confirmText={loading ? "Logging..." : "Log Period"}
      onConfirm={handleLog}
      confirmDisabled={loading}
      scrollable
    >
      <ScrollView style={styles.content}>
        {settings && (
          <View style={[styles.section, styles.infoBox]}>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Period Duration:</Text>{" "}
              {settings.periodDays} days
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Cycle Length:</Text>{" "}
              {settings.cycleLengthDays} days
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder='Add any symptoms or notes...'
            placeholderTextColor={colors.textSecondary}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />
        </View>

        {error && (
          <View style={[styles.section, styles.errorBox]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </ModalSheet>
  );
}
const makeLogCycleStyles = (colors: any) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    infoBox: {
      backgroundColor: "#f3e8ff",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#d8b4fe",
      padding: 12,
    },
    infoText: {
      fontSize: 13,
      color: "#6b21a8",
      marginBottom: 4,
    },
    infoLabel: {
      fontWeight: "600",
    },
    noteInput: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 12,
      minHeight: 90,
      fontSize: 14,
      color: colors.textPrimary,
      textAlignVertical: "top",
    },
    errorBox: {
      backgroundColor: "#fee2e2",
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: "#fca5a5",
    },
    errorText: {
      color: "#7f1d1d",
      fontSize: 14,
    },
  });

interface CycleSettingsWidgetProps {
  readonly onSettingsUpdate?: (settings: {
    periodDays: number;
    cycleLengthDays: number;
  }) => void;
}

export function CycleSettingsWidget({
  onSettingsUpdate,
}: CycleSettingsWidgetProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [periodDays, setPeriodDays] = useState<number>(5);
  const [cycleLengthDays, setCycleLengthDays] = useState<number>(28);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const styles = makeCycleSettingsStyles(colors);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await menstrualApi.getSettings();
      if (response.success && response.data) {
        setPeriodDays(response.data.periodDays);
        setCycleLengthDays(response.data.cycleLengthDays);
      }
    } catch (err) {
      console.error("Failed to load cycle settings:", err);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess(false);

      await menstrualApi.setSettings(periodDays, cycleLengthDays);

      setSuccess(true);
      onSettingsUpdate?.({ periodDays, cycleLengthDays });

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View>
          <Text style={styles.headerTitle}>Cycle Settings</Text>
          <Text style={styles.headerSubtitle}>
            Period: {periodDays}d • Cycle: {cycleLengthDays}d
          </Text>
        </View>
        <Text style={[styles.chevron, expanded && styles.chevronOpen]}>⌄</Text>
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Period Duration (days)</Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => setPeriodDays(Math.max(1, periodDays - 1))}
              >
                <Text style={styles.buttonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={String(periodDays)}
                onChangeText={(text) =>
                  setPeriodDays(Math.max(1, Number.parseInt(text, 10) || 1))
                }
                keyboardType='number-pad'
              />
              <TouchableOpacity
                style={styles.button}
                onPress={() => setPeriodDays(Math.min(14, periodDays + 1))}
              >
                <Text style={styles.buttonText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Typical: 3-7 days</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Average Cycle Length (days)</Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.button}
                onPress={() =>
                  setCycleLengthDays(Math.max(20, cycleLengthDays - 1))
                }
              >
                <Text style={styles.buttonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={String(cycleLengthDays)}
                onChangeText={(text) =>
                  setCycleLengthDays(
                    Math.max(20, Number.parseInt(text, 10) || 28),
                  )
                }
                keyboardType='number-pad'
              />
              <TouchableOpacity
                style={styles.button}
                onPress={() =>
                  setCycleLengthDays(Math.min(50, cycleLengthDays + 1))
                }
              >
                <Text style={styles.buttonText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Typical: 21-35 days</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                ✓ Settings saved successfully
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setExpanded(false)}
              disabled={loading}
            >
              <Text style={[styles.actionButtonText, styles.cancelButtonText]}>
                Close
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>
                {loading ? "Saving..." : "Save Settings"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const makeCycleSettingsStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      marginTop: 16,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: "#f3e8ff",
      borderBottomWidth: 0,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    chevron: {
      fontSize: 20,
      color: colors.textPrimary,
      transform: [{ rotate: "0deg" }],
    },
    chevronOpen: {
      transform: [{ rotate: "180deg" }],
    },
    content: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: colors.inputBorder,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 10,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    button: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: "#e5e7eb",
      justifyContent: "center",
      alignItems: "center",
    },
    buttonText: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
    },
    hint: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 6,
    },
    errorBox: {
      backgroundColor: "#fee2e2",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#fca5a5",
      padding: 12,
      marginBottom: 12,
    },
    errorText: {
      color: "#7f1d1d",
      fontSize: 13,
    },
    successBox: {
      backgroundColor: "#dcfce7",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#86efac",
      padding: 12,
      marginBottom: 12,
    },
    successText: {
      color: "#166534",
      fontSize: 13,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelButton: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    cancelButtonText: {
      color: colors.textPrimary,
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#fff",
    },
  });
