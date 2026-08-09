import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import UniversalCalendar from "@shared/components/UniversalCalendar";
import { DOMSFollowUpWidget, DOMSHeatmapWidget, InjuryTrackerWidget } from "../tabs/SorenessTab";

export interface SorenessRenderCtx {
  entries: any[];
  openSorenessModal: () => void;
  setSelectedLogDate: (date: Date | null) => void;
  deleteSorenessEntry: (entry: any) => void;
  hasDataOnDate: (date: Date) => boolean;
  styles: any;
  handleCalendarDatePress: (date: Date, type: string) => void;
}

export function renderSorenessWidget(type: string, ctx: SorenessRenderCtx): React.ReactNode {
  const { entries, openSorenessModal, setSelectedLogDate, deleteSorenessEntry, hasDataOnDate, styles, handleCalendarDatePress } = ctx;

  switch (type) {
    case "soreness_map": {
      if (entries.length === 0)
        return (
          <View style={styles.trackerEmptyCard}>
            <Text style={styles.trackerEmptyIcon}>🔥</Text>
            <Text style={styles.trackerEmptyText}>No soreness logged yet.</Text>
            <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: "#ea580c", marginTop: 0, paddingHorizontal: 16 }]} onPress={() => { setSelectedLogDate(null); openSorenessModal(); }}>
              <Text style={styles.trackerHeroButtonText}>+ Log Soreness</Text>
            </TouchableOpacity>
          </View>
        );
      const last = entries[0];
      const lastIntensity = Number(last.intensity ?? last.value ?? 0);
      const intensityColor = lastIntensity <= 3 ? "#22c55e" : lastIntensity <= 6 ? "#f59e0b" : "#ef4444";
      return (
        <View style={[styles.trackerHeroCard, { backgroundColor: "#fff7ed", borderColor: "#fed7aa" }]}>
          <View style={styles.trackerHeroTop}>
            <View style={[styles.trackerHeroBadge, { backgroundColor: "#fff" }]}>
              <Text style={styles.trackerHeroBadgeIcon}>🔥</Text>
            </View>
            <Text style={[styles.trackerHeroLabel, { color: intensityColor }]}>{lastIntensity}/10</Text>
          </View>
          <Text style={[styles.trackerHeroValue, { color: "#9a3412" }]}>{last.muscleGroup ?? last.muscle ?? last.muscle_group ?? "—"}</Text>
          <Text style={styles.trackerHeroDate}>{new Date(last.loggedAt ?? last.recorded_at ?? last.date ?? "").toLocaleDateString()}</Text>
          <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: "#ea580c" }]} onPress={() => { setSelectedLogDate(null); openSorenessModal(); }}>
            <Text style={styles.trackerHeroButtonText}>+ Log Soreness</Text>
          </TouchableOpacity>
        </View>
      );
    }

    case "soreness_calendar":
      return <UniversalCalendar hasDataOnDate={hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "soreness")} initialView="month" legendText="Soreness logged · tap any day to view/add" dotColor="#f97316" />;

    case "soreness_history": {
      if (entries.length === 0)
        return (
          <View style={styles.trackerEmptyCard}>
            <Text style={styles.trackerEmptyIcon}>🔥</Text>
            <Text style={styles.trackerEmptyText}>No soreness entries yet.</Text>
          </View>
        );
      return (
        <View style={styles.trackerHistoryList}>
          {entries.map((s: any, i: number) => {
            const val = Number(s.intensity ?? s.value ?? 0);
            const dotColor = val <= 3 ? "#22c55e" : val <= 6 ? "#f59e0b" : "#ef4444";
            return (
              <View key={s.id ?? i} style={[styles.trackerHistoryRow, i < entries.length - 1 && styles.trackerHistoryRowBorder]}>
                <View style={styles.trackerHistoryLeft}>
                  <View style={[styles.trackerHistoryDot, { backgroundColor: dotColor }]} />
                  <View>
                    <Text style={styles.trackerHistoryDate}>{new Date(s.loggedAt ?? s.recorded_at ?? s.date ?? "").toLocaleDateString()}</Text>
                    <Text style={styles.trackerHistoryTime}>{`${s.muscleGroup ?? s.muscle ?? s.muscle_group ?? "—"} · ${val}/10`}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.trackerDeleteBtn} onPress={() => deleteSorenessEntry(s)}>
                  <Text style={styles.trackerDeleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      );
    }

    case "doms_followup": return <DOMSFollowUpWidget />;
    case "doms_heatmap": return <DOMSHeatmapWidget />;
    case "injury_tracker": return <InjuryTrackerWidget />;

    default: return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
  }
}
