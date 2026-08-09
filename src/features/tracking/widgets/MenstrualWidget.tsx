import React, { useState, useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import UniversalCalendar from "@shared/components/UniversalCalendar";
import { CycleSettingsWidget } from "../tabs";
import { getCycleStartIso, getCycleDuration, getCycleFlowLabel, getCyclePhaseLabel, computeUpcomingPredictedDays, formatDateLabel } from "../utils";
import { toDateString } from "@utils/format";

export interface MenstrualRenderCtx {
  entries: any[];
  prefs: { periodLengthDays: number; cycleLengthDays: number };
  setPrefs: (p: { periodLengthDays: number; cycleLengthDays: number }) => void;
  actualDays: Set<string>;
  predictedDays: Set<string>;
  setPredictedDays: (s: Set<string>) => void;
  openCycleModal: () => void;
  setSelectedLogDate: (date: Date | null) => void;
  hasDataOnDate: (date: Date) => boolean;
  styles: any;
  handleCalendarDatePress: (date: Date, type: string) => void;
}

export function renderMenstrualWidget(type: string, ctx: MenstrualRenderCtx): React.ReactNode {
  const { entries, prefs, setPrefs, actualDays, predictedDays, setPredictedDays, openCycleModal, setSelectedLogDate, hasDataOnDate, styles, handleCalendarDatePress } = ctx;

  const [expandedCycleIds, setExpandedCycleIds] = useState<Set<string>>(new Set());
  const toggleExpandedCycle = useCallback((id: string) => {
    setExpandedCycleIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  switch (type) {
    case "menstrual_overview": {
      if (entries.length === 0) return <Text style={styles.widgetLineMuted}>No cycle data yet.</Text>;
      const last = entries[0];
      const lastPhase = getCyclePhaseLabel(getCycleStartIso(last), prefs.periodLengthDays, prefs.cycleLengthDays) ?? "—";
      return (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Cycle Status</Text>
          <Text style={styles.statsValue}>{`Phase: ${lastPhase}`}</Text>
          <Text style={styles.statsDate}>{`Started: ${formatDateLabel(getCycleStartIso(last))}`}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => { setSelectedLogDate(null); openCycleModal(); }}>
            <Text style={styles.primaryButtonText}>+ Log Cycle</Text>
          </TouchableOpacity>
        </View>
      );
    }

    case "menstrual_calendar":
      return (
        <UniversalCalendar
          hasDataOnDate={hasDataOnDate}
          onDatePress={(date: Date) => handleCalendarDatePress(date, "menstrual")}
          initialView="month"
          legendText="Cycle start · tap any day to view/add"
          dotColor="#ec4899"
          getDayDecoration={(date: Date) => {
            const ds = toDateString(date);
            if (actualDays.has(ds)) return { backgroundColor: "rgba(224,79,95,0.12)", dotColor: "#e04f5f" };
            if (predictedDays.has(ds)) return { backgroundColor: "rgba(239,68,68,0.20)", dotColor: "#ef4444" };
            return null;
          }}
        />
      );

    case "menstrual_cycle":
      return (
        <View>
          <CycleSettingsWidget onSettingsUpdate={async ({ periodDays, cycleLengthDays }) => {
            const updatedPrefs = { periodLengthDays: periodDays, cycleLengthDays };
            setPrefs(updatedPrefs);
            try {
              const mostRecentStartIso = entries.length > 0 ? getCycleStartIso(entries[0]) : null;
              const nextSet = computeUpcomingPredictedDays(mostRecentStartIso, cycleLengthDays, periodDays);
              setPredictedDays(nextSet);
            } catch (e) { console.warn("Failed to refresh cycle predictions:", e); }
          }} />
          <TouchableOpacity style={[styles.primaryButton, { marginTop: 12 }]} onPress={() => { setSelectedLogDate(new Date()); openCycleModal(); }}>
            <Text style={styles.primaryButtonText}>+ Log Cycle Today</Text>
          </TouchableOpacity>
        </View>
      );

    case "menstrual_history": {
      if (entries.length === 0) return <Text style={styles.widgetLineMuted}>No cycle history yet.</Text>;
      return (
        <View>
          {entries.map((c: any, i: number) => {
            const entryId = c.id ?? i;
            const entryKey = String(entryId);
            const isExpanded = expandedCycleIds.has(entryKey);
            const startDateLabel = formatDateLabel(getCycleStartIso(c));
            return (
              <View key={entryKey} style={styles.cycleHistoryRow}>
                <TouchableOpacity style={[styles.weightEntryRow, i < entries.length - 1 && styles.weightEntryRowBorder]} onPress={() => toggleExpandedCycle(entryKey)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.weightEntryDate}>{startDateLabel}</Text>
                    <Text style={styles.weightEntryTime}>{`Duration: ${getCycleDuration(c)} days · Flow: ${getCycleFlowLabel(c)}`}</Text>
                  </View>
                  <Text style={styles.cycleToggleText}>{isExpanded ? "Hide details" : "Show details"}</Text>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.cycleDetailsBox}>
                    {i === 0 && (() => {
                      const phase = getCyclePhaseLabel(getCycleStartIso(c), prefs.periodLengthDays, prefs.cycleLengthDays);
                      return phase ? <Text style={styles.cycleDetailsLine}>Phase: {phase}</Text> : null;
                    })()}
                    <Text style={styles.cycleDetailsLine}>Cycle start: {startDateLabel}</Text>
                    <Text style={styles.cycleDetailsLine}>Period length: {getCycleDuration(c)} days</Text>
                    {(c.notes || c.note) && <Text style={styles.cycleDetailsNote}>Note: {Array.isArray(c.notes) ? c.notes[0] : (c.notes ?? c.note)}</Text>}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
    }

    default: return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
  }
}
