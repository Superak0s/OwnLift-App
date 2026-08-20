import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { MUSCLE_GROUP_LABELS } from "../types/muscleRecovery";
import { STORAGE_KEYS } from "@shared/services/storage";
import type { WidgetDefinition, WidgetInstance } from "@shared/types";
import { useTheme } from "@shared/context/ThemeContext";
import { domsApi } from "../services";
import type { ActiveSoreness, MuscleGroup } from "../types/muscleRecovery";

import MuscleMap from "../components/MuscleMap";
import { MuscleSorenessModal } from "../components/MuscleSorenessModal";
import { DOMSFollowUp } from "../components/DOMSFollowUp";
import { DOMSHeatmap } from "../components/DOMSHeatmap";
import { InjuryTracker } from "../components/InjuryTracker";
import { LogInjuryModal } from "../components/LogInjuryModal";
import { MuscleDashboard } from "../components/MuscleDashboard";


export type SorenessWidgetType =
  | "muscle_map"
  | "doms_followup"
  | "doms_heatmap"
  | "injury_tracker";

export const SORENESS_WIDGET_REGISTRY: Record<
  SorenessWidgetType,
  WidgetDefinition<SorenessWidgetType>
> = {
  muscle_map: {
    type: "muscle_map",
    title: "Muscle Map",
    description: "Tap any muscle to log soreness — front and back views",
    icon: "🧍",
    availableSizes: ["large"],
    defaultSize: "large",
    singleton: true,
  },
  doms_followup: {
    type: "doms_followup",
    title: "Morning Recovery Check",
    description: "Follow up on muscles that are currently sore",
    icon: "☀️",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  doms_heatmap: {
    type: "doms_heatmap",
    title: "Recovery Analytics",
    description: "Frequency, recovery time, and severity trends by muscle",
    icon: "📈",
    availableSizes: ["large"],
    defaultSize: "large",
    singleton: true,
  },
  injury_tracker: {
    type: "injury_tracker",
    title: "Injury History",
    description: "Track injuries separately from everyday soreness",
    icon: "🏥",
    availableSizes: ["large"],
    defaultSize: "large",
    singleton: true,
  },
};

export const DEFAULT_SORENESS_WIDGETS: WidgetInstance<SorenessWidgetType>[] = [
  { id: "default-muscle-map", type: "muscle_map", size: "large", order: 0 },
  {
    id: "default-doms-followup",
    type: "doms_followup",
    size: "large",
    order: 1,
  },
];

export const SORENESS_WIDGETS_STORAGE_KEY = STORAGE_KEYS.SORENESS_TAB_WIDGETS;

export const SORENESS_TAB_CONFIG = {
  key: "soreness",
  icon: "💪",
  label: "Recovery",
};


function buildSorenessMap(
  activeSoreness: ActiveSoreness[],
): Partial<Record<MuscleGroup, number>> {
  const map: Partial<Record<MuscleGroup, number>> = {};
  for (const s of activeSoreness) {
    // If a muscle somehow has more than one active record, keep the higher
    // intensity so the map reflects the worse of the two.
    if (!map[s.muscleGroup] || map[s.muscleGroup]! < s.intensity) {
      map[s.muscleGroup] = s.intensity;
    }
  }
  return map;
}

// A muscle dashboard overlay used by every widget below — kept as a small
// local component so each widget can drill into a muscle without needing
// screen-level navigation state.
function MuscleDashboardOverlay({
  muscle,
  onClose,
}: {
  muscle: MuscleGroup | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!muscle} animationType='slide' onRequestClose={onClose}>
      {muscle && <MuscleDashboard muscleGroup={muscle} onClose={onClose} />}
    </Modal>
  );
}


export function MuscleMapWidget() {
  const { colors } = useTheme();
  const [view, setView] = useState<"front" | "back">("front");
  const [activeSoreness, setActiveSoreness] = useState<ActiveSoreness[]>([]);
  const [tappedMuscle, setTappedMuscle] = useState<MuscleGroup | null>(null);

  const loadActiveSoreness = useCallback(async () => {
    try {
      const response = await domsApi.getActiveSoreness();
      const data = (response as any)?.data ?? response;
      setActiveSoreness(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load active soreness:", err);
    }
  }, []);

  useEffect(() => {
    loadActiveSoreness();
  }, [loadActiveSoreness]);

  const sorenessMap = buildSorenessMap(activeSoreness);

  return (
    <View>
      <View style={mapWidgetStyles.viewToggle}>
        {(["front", "back"] as const).map((v) => (
          <TouchableOpacity
            key={v}
            style={[
              mapWidgetStyles.viewToggleBtn,
              { backgroundColor: view === v ? colors.accent : "transparent" },
            ]}
            onPress={() => setView(v)}
          >
            <Text
              style={{
                color: view === v ? "white" : colors.textSecondary,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {v === "front" ? "Front" : "Back"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <MuscleMap
        view={view}
        selectedMuscles={new Set()}
        sorenessMap={sorenessMap as Record<MuscleGroup, number>}
        onPressMuscle={(muscle) => setTappedMuscle(muscle)}
        showLabels
      />
      <Text style={[mapWidgetStyles.mapHint, { color: colors.textSecondary }]}>
        Tap a muscle to log soreness
      </Text>
      {tappedMuscle && (
        <MuscleSorenessModal
          visible={!!tappedMuscle}
          muscleGroup={tappedMuscle}
          onClose={() => setTappedMuscle(null)}
          onSuccess={loadActiveSoreness}
        />
      )}
    </View>
  );
}

const mapWidgetStyles = StyleSheet.create({
  viewToggle: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#00000010",
    borderRadius: 8,
    padding: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  viewToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  mapHint: {
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
  },
});


export function DOMSFollowUpWidget() {
  const [dashboardMuscle, setDashboardMuscle] = useState<MuscleGroup | null>(
    null,
  );

  return (
    <View>
      <DOMSFollowUp
        onNavigateToMuscleDashboard={(muscle) =>
          setDashboardMuscle(muscle as MuscleGroup)
        }
      />
      <MuscleDashboardOverlay
        muscle={dashboardMuscle}
        onClose={() => setDashboardMuscle(null)}
      />
    </View>
  );
}


export function DOMSHeatmapWidget() {
  const [dashboardMuscle, setDashboardMuscle] = useState<MuscleGroup | null>(
    null,
  );

  return (
    <View>
      <DOMSHeatmap
        onSelectMuscle={(muscle) => setDashboardMuscle(muscle as MuscleGroup)}
      />
      <MuscleDashboardOverlay
        muscle={dashboardMuscle}
        onClose={() => setDashboardMuscle(null)}
      />
    </View>
  );
}


export function InjuryTrackerWidget() {
  const [showLogModal, setShowLogModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <View>
      <InjuryTracker
        key={refreshKey}
        onLogInjury={() => setShowLogModal(true)}
      />
      <LogInjuryModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </View>
  );
}

// TrackingScreen wires several existing entry points (calendar day-taps,
// hero-card "+ Log Soreness" buttons) to a `LogSorenessModal` component with
// this exact `{ visible, onClose, onSuccess }` shape. Rather than requiring
// call-site changes throughout that file, this keeps the same contract but
// replaces the old flat muscle-chip picker with the same interactive map
// used everywhere else in this tab, so soreness logging is consistently
// "tap a muscle" rather than "pick from a list" no matter where it's opened
// from.

interface LogSorenessModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (data: any) => void;
}

export function LogSorenessModal({
  visible,
  onClose,
  onSuccess,
}: LogSorenessModalProps) {
  const { colors } = useTheme();
  const [view, setView] = useState<"front" | "back">("front");
  const [tappedMuscle, setTappedMuscle] = useState<MuscleGroup | null>(null);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.quickLogBackdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[styles.quickLogSheet, { backgroundColor: colors.background }]}
        >
          <View style={styles.quickLogHeader}>
            <Text style={[styles.quickLogTitle, { color: colors.textPrimary }]}>
              Tap a muscle to log soreness
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.quickLogClose, { color: colors.accent }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.viewToggle}>
            {(["front", "back"] as const).map((v) => (
              <TouchableOpacity
                key={v}
                style={[
                  styles.viewToggleBtn,
                  {
                    backgroundColor: view === v ? colors.accent : "transparent",
                  },
                ]}
                onPress={() => setView(v)}
              >
                <Text
                  style={{
                    color: view === v ? "white" : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {v === "front" ? "Front" : "Back"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <MuscleMap
            view={view}
            selectedMuscles={new Set()}
            sorenessMap={{} as Record<MuscleGroup, number>}
            onPressMuscle={(muscle) => setTappedMuscle(muscle)}
            showLabels
          />
        </View>
      </View>

      {tappedMuscle && (
        <MuscleSorenessModal
          visible={!!tappedMuscle}
          muscleGroup={tappedMuscle}
          onClose={() => setTappedMuscle(null)}
          onSuccess={() => {}}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  quickLogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  quickLogSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "85%",
  },
  quickLogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  quickLogTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  quickLogClose: {
    fontSize: 14,
    fontWeight: "700",
  },
  
  viewToggle: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#00000010",
    borderRadius: 8,
    padding: 2,
  },
  viewToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  
  
  
  
  
  
  
  
  
  
});
