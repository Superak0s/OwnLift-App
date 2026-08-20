import { STORAGE_KEYS } from "@shared/services/storage";
import type { WidgetDefinition, WidgetInstance } from "@shared/types";


export type HydrationWidgetType =
  | "hydration_overview"
  | "hydration_calendar"
  | "hydration_goal"
  | "hydration_history";

export const HYDRATION_WIDGET_REGISTRY: Record<
  HydrationWidgetType,
  WidgetDefinition<HydrationWidgetType>
> = {
  hydration_overview: {
    type: "hydration_overview",
    title: "Today's Hydration",
    description: "Daily water intake vs. goal",
    icon: "💧",
    availableSizes: ["small", "medium"],
    defaultSize: "medium",
    singleton: true,
  },
  hydration_calendar: {
    type: "hydration_calendar",
    title: "Hydration Calendar",
    description: "Calendar view of days you've logged hydration",
    icon: "📅",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  hydration_goal: {
    type: "hydration_goal",
    title: "Weekly Goal",
    description: "This week's hydration progress and average",
    icon: "🎯",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  hydration_history: {
    type: "hydration_history",
    title: "Hydration History",
    description: "Recent hydration entries",
    icon: "📋",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
};

export const DEFAULT_HYDRATION_WIDGETS: WidgetInstance<HydrationWidgetType>[] = [
  {
    id: "default-hydration-overview",
    type: "hydration_overview",
    size: "medium",
    order: 0,
  },
  {
    id: "default-hydration-calendar",
    type: "hydration_calendar",
    size: "large",
    order: 1,
  },
  {
    id: "default-hydration-goal",
    type: "hydration_goal",
    size: "medium",
    order: 2,
  },
  {
    id: "default-hydration-history",
    type: "hydration_history",
    size: "medium",
    order: 3,
  },
];

export const HYDRATION_WIDGETS_STORAGE_KEY = STORAGE_KEYS.HYDRATION_TAB_WIDGETS;


export const HYDRATION_TAB_CONFIG = {
  key: "hydration",
  icon: "💧",
  label: "Hydration",
};


import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useTheme } from "@shared/context/ThemeContext";
import { useAuth } from "@shared/context/AuthContext";
import ModalSheet from "@shared/components/ModalSheet";
import { hydrationApi } from "../services";
import { saveToStorage, loadFromStorage } from "@shared/services/storage";

interface HydrationPreset {
  label: string;
  ml: number;
  icon: string;
}

const DEFAULT_HYDRATION_PRESETS: HydrationPreset[] = [
  { label: "Small Glass", ml: 250, icon: "🥃" },
  { label: "Regular Glass", ml: 500, icon: "🥤" },
  { label: "Water Bottle", ml: 750, icon: "🍶" },
  { label: "Large Bottle", ml: 1000, icon: "💧" },
];

interface LogHydrationModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (data: any) => void;
}

const STEP_ML = 50;

export function LogHydrationModal({
  visible,
  onClose,
  onSuccess,
}: LogHydrationModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [amountMl, setAmountMl] = useState<number>(500);
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [settings, setSettings] = useState<{
    goalMl: number;
    measurementErrorPercent: number;
  } | null>(null);
  const [presets, setPresets] = useState<HydrationPreset[]>(DEFAULT_HYDRATION_PRESETS);
  const [editingPresets, setEditingPresets] = useState(false);
  const [errorPercent, setErrorPercent] = useState(0);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (visible) {
      loadSettings();
      loadPresets();
    }
  }, [visible]);

  const loadPresets = async () => {
    const saved = await loadFromStorage<HydrationPreset[]>(STORAGE_KEYS.HYDRATION_PRESETS, user?.id ?? null);
    if (saved?.length) setPresets(saved);
  };

  const updatePresetMl = (index: number, ml: number) => {
    setPresets((prev) => prev.map((p, i) => (i === index ? { ...p, ml } : p)));
  };

  const savePresets = async () => {
    await saveToStorage(STORAGE_KEYS.HYDRATION_PRESETS, presets, user?.id ?? null);
    setEditingPresets(false);
  };

  const loadSettings = async () => {
    try {
      const response = await hydrationApi.getSettings();
      if (response.success && response.data) {
        setSettings(response.data);
        setErrorPercent(response.data.measurementErrorPercent);
      }
    } catch (err) {
      console.error("Failed to load hydration settings:", err);
    }
  };

  const handleLog = async () => {
    try {
      setLoading(true);
      setError("");

      if (settings && errorPercent !== settings.measurementErrorPercent) {
        await hydrationApi.setSettings(undefined, errorPercent);
      }
      await hydrationApi.logHydration(amountMl, note || undefined);

      setAmountMl(500);
      setNote("");
      onClose();
      onSuccess?.({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log hydration");
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = settings
    ? Math.min((amountMl / settings.goalMl) * 100, 100)
    : 0;

  const errorMl = Math.round((amountMl * errorPercent) / 100);
  const rangeLow = Math.max(0, amountMl - errorMl);
  const rangeHigh = amountMl + errorMl;

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title='Log Hydration'
      confirmText={loading ? "Logging..." : "Log Hydration"}
      onConfirm={handleLog}
      confirmDisabled={loading}
      scrollable
    >
      <ScrollView style={styles.content}>
        <View style={styles.amountBox}>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setAmountMl((v) => Math.max(0, v - STEP_ML))}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>

            <View style={styles.amountCenter}>
              <Text style={styles.amountValue}>{amountMl}</Text>
              <Text style={styles.amountLabel}>ml</Text>
            </View>

            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setAmountMl((v) => v + STEP_ML)}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.errorRangeBadge}>
            <View style={styles.errorStepperRow}>
              <TouchableOpacity
                style={styles.errorStepperButton}
                onPress={() => setErrorPercent((v) => Math.max(0, v - 1))}
              >
                <Text style={styles.errorStepperButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.errorRangeText}>
                ±{errorPercent}% measurement error
              </Text>
              <TouchableOpacity
                style={styles.errorStepperButton}
                onPress={() => setErrorPercent((v) => Math.min(20, v + 1))}
              >
                <Text style={styles.errorStepperButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            {errorPercent > 0 && (
              <Text style={styles.errorRangeText}>
                ≈ {rangeLow}–{rangeHigh}ml
              </Text>
            )}
          </View>

          {settings && (
            <>
              <Text style={styles.goalText}>
                {Math.round(progressPercentage)}% of {settings.goalMl}ml goal
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercentage}%` },
                  ]}
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exact Amount (ml)</Text>
          <TextInput
            style={styles.amountInput}
            placeholder='500'
            placeholderTextColor={colors.textSecondary}
            value={String(amountMl)}
            onChangeText={(text) =>
              setAmountMl(Math.max(0, Number.parseInt(text, 10) || 0))
            }
            keyboardType='number-pad'
          />
        </View>

        <View style={styles.section}>
          <View style={styles.presetHeaderRow}>
            <Text style={styles.sectionTitle}>Quick Presets</Text>
            <TouchableOpacity onPress={() => (editingPresets ? savePresets() : setEditingPresets(true))}>
              <Text style={styles.presetEditLink}>{editingPresets ? "Done" : "Edit"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.presetGrid}>
            {presets.map((preset, index) =>
              editingPresets ? (
                <View key={preset.label} style={styles.presetButton}>
                  <Text style={styles.presetButtonIcon}>{preset.icon}</Text>
                  <Text style={styles.presetButtonText}>{preset.label}</Text>
                  <TextInput
                    style={styles.presetEditInput}
                    value={String(preset.ml)}
                    onChangeText={(text) => updatePresetMl(index, Math.max(0, Number.parseInt(text, 10) || 0))}
                    keyboardType='number-pad'
                  />
                </View>
              ) : (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    styles.presetButton,
                    amountMl === preset.ml && styles.presetButtonActive,
                  ]}
                  onPress={() => setAmountMl(preset.ml)}
                >
                  <Text style={styles.presetButtonIcon}>{preset.icon}</Text>
                  <Text
                    style={[
                      styles.presetButtonText,
                      amountMl === preset.ml && styles.presetButtonTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                  <Text
                    style={[
                      styles.presetButtonSubtext,
                      amountMl === preset.ml && styles.presetButtonSubtextActive,
                    ]}
                  >
                    {preset.ml}ml
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder='e.g., After workout, Before bed...'
            placeholderTextColor={colors.textSecondary}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={2}
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

const makeStyles = (colors: any) =>
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
    presetHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    presetEditLink: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
      marginBottom: 12,
    },
    presetEditInput: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 12,
      color: colors.textPrimary,
      textAlign: "center",
      backgroundColor: colors.background,
      minWidth: 60,
    },
    amountBox: {
      backgroundColor: "#e0f2fe",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#7dd3fc",
      padding: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
    },
    stepperButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#fff",
      borderWidth: 1,
      borderColor: "#7dd3fc",
      alignItems: "center",
      justifyContent: "center",
    },
    stepperButtonText: {
      fontSize: 20,
      fontWeight: "700",
      color: "#0369a1",
    },
    amountCenter: {
      alignItems: "center",
      minWidth: 90,
    },
    amountValue: {
      fontSize: 34,
      fontWeight: "700",
      color: "#0c4a6e",
    },
    amountLabel: {
      fontSize: 14,
      color: "#0369a1",
      marginTop: 2,
    },
    goalText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#0c4a6e",
      marginTop: 14,
    },
    errorRangeBadge: {
      marginTop: 10,
      backgroundColor: "rgba(255,255,255,0.6)",
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    errorRangeText: {
      fontSize: 11,
      fontWeight: "600",
      color: "#0369a1",
    },
    errorStepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    errorStepperButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#fff",
      borderWidth: 1,
      borderColor: "#7dd3fc",
      alignItems: "center",
      justifyContent: "center",
    },
    errorStepperButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#0369a1",
    },
    progressBar: {
      width: "100%",
      height: 8,
      backgroundColor: "#bae6fd",
      borderRadius: 4,
      marginTop: 8,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: "#0369a1",
      borderRadius: 4,
    },
    amountInput: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 10,
      padding: 12,
      fontSize: 18,
      color: colors.textPrimary,
      textAlign: "center",
      fontWeight: "600",
      backgroundColor: colors.surface,
    },
    presetGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    presetButton: {
      flex: 0.45,
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    presetButtonActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    presetButtonIcon: {
      fontSize: 18,
      marginBottom: 4,
    },
    presetButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    presetButtonTextActive: {
      color: "#fff",
    },
    presetButtonSubtext: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    presetButtonSubtextActive: {
      color: "#fff",
      opacity: 0.8,
    },
    noteInput: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 12,
      padding: 12,
      minHeight: 60,
      fontSize: 14,
      color: colors.textPrimary,
      textAlignVertical: "top",
      backgroundColor: colors.surface,
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


import {
  View as V2,
  Text as T2,
  TouchableOpacity as TS2,
  TextInput as TI2,
  ScrollView as SV2,
} from "react-native";

interface HydrationSettingsWidgetProps {
  readonly onSettingsUpdate?: (settings: {
    goalMl: number;
    measurementErrorPercent: number;
  }) => void;
}

export function HydrationSettingsWidget({
  onSettingsUpdate,
}: HydrationSettingsWidgetProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [goalMl, setGoalMl] = useState<number>(2000);
  const [measurementErrorPercent, setMeasurementErrorPercent] =
    useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const styles = makeHydrationSettingsStyles(colors);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await hydrationApi.getSettings();
      if (response.success && response.data) {
        setGoalMl(response.data.goalMl);
        setMeasurementErrorPercent(response.data.measurementErrorPercent);
        onSettingsUpdate?.({
          goalMl: response.data.goalMl,
          measurementErrorPercent: response.data.measurementErrorPercent,
        });
      }
    } catch (err) {
      console.error("Failed to load hydration settings:", err);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess(false);

      await hydrationApi.setSettings(goalMl, measurementErrorPercent);

      setSuccess(true);
      onSettingsUpdate?.({ goalMl, measurementErrorPercent });

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const presetGoals = [1500, 2000, 2500, 3000];

  return (
    <V2 style={styles.container}>
      <TS2
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <V2 style={styles.headerLeft}>
          <V2 style={styles.headerIconWrap}>
            <T2 style={styles.headerIcon}>💧</T2>
          </V2>
          <V2>
            <T2 style={styles.headerTitle}>Hydration Settings</T2>
            <T2 style={styles.headerSubtitle}>
              Goal {(goalMl / 1000).toFixed(1)}L · Error ±
              {measurementErrorPercent}%
            </T2>
          </V2>
        </V2>
        <T2 style={[styles.chevron, expanded && styles.chevronOpen]}>⌄</T2>
      </TS2>

      {expanded && (
        <SV2 style={styles.content}>
          <V2 style={styles.section}>
            <T2 style={styles.sectionTitle}>Daily Hydration Goal (ml)</T2>
            <TI2
              style={styles.mainInput}
              value={String(goalMl)}
              onChangeText={(text) =>
                setGoalMl(Math.max(500, Number.parseInt(text, 10) || 2000))
              }
              keyboardType='number-pad'
            />

            <V2 style={styles.presetSection}>
              <T2 style={styles.presetLabel}>Quick presets</T2>
              <V2 style={styles.presetGrid}>
                {presetGoals.map((preset) => (
                  <TS2
                    key={preset}
                    style={[
                      styles.presetButton,
                      goalMl === preset && styles.presetButtonActive,
                    ]}
                    onPress={() => setGoalMl(preset)}
                  >
                    <T2
                      style={[
                        styles.presetButtonText,
                        goalMl === preset && styles.presetButtonTextActive,
                      ]}
                    >
                      {preset / 1000}L
                    </T2>
                  </TS2>
                ))}
              </V2>
            </V2>
          </V2>

          {error && (
            <V2 style={styles.errorBox}>
              <T2 style={styles.errorText}>{error}</T2>
            </V2>
          )}

          {success && (
            <V2 style={styles.successBox}>
              <T2 style={styles.successText}>
                ✓ Settings saved successfully
              </T2>
            </V2>
          )}

          <V2 style={styles.buttonRow}>
            <TS2
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setExpanded(false)}
              disabled={loading}
            >
              <T2 style={[styles.actionButtonText, styles.cancelButtonText]}>
                Close
              </T2>
            </TS2>
            <TS2
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
            >
              <T2 style={styles.actionButtonText}>
                {loading ? "Saving..." : "Save Settings"}
              </T2>
            </TS2>
          </V2>
        </SV2>
      )}
    </V2>
  );
}

const makeHydrationSettingsStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 16,
      marginTop: 16,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: "#e0f2fe",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    headerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    headerIcon: {
      fontSize: 17,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 12,
      color: "#0369a1",
      marginTop: 2,
      fontWeight: "500",
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
      borderTopColor: colors.surfaceBorder,
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
    mainInput: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 12,
      backgroundColor: colors.background,
    },
    presetSection: {
      marginTop: 12,
    },
    presetLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
      fontWeight: "500",
    },
    presetGrid: {
      flexDirection: "row",
      gap: 8,
    },
    presetButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: "center",
    },
    presetButtonActive: {
      backgroundColor: "#0369a1",
      borderColor: "#0369a1",
    },
    presetButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    presetButtonTextActive: {
      color: "#fff",
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    button: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    buttonText: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
      backgroundColor: colors.background,
    },
    
    hint: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 6,
    },
    errorBox: {
      backgroundColor: "#fee2e2",
      borderRadius: 10,
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
      borderRadius: 10,
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
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    saveButton: {
      backgroundColor: colors.accent,
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
