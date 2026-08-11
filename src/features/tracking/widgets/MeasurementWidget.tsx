import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import UniversalCalendar from "@shared/components/UniversalCalendar";
import ProgressChart from "@shared/components/ProgressChart";

export interface MeasurementRenderCtx {
  history: any[];
  customEntries: any[];
  openMeasurementModal: () => void;
  setSelectedLogDate: (date: Date | null) => void;
  deleteMeasurementEntry: (entry: any) => void;
  hasDataOnDate: (date: Date) => boolean;
  colors: any;
  styles: any;
  handleCalendarDatePress: (date: Date, type: string) => void;
}

export function renderMeasurementWidget(type: string, ctx: MeasurementRenderCtx): React.ReactNode {
  const { history, customEntries, openMeasurementModal, setSelectedLogDate, deleteMeasurementEntry, hasDataOnDate, colors, styles, handleCalendarDatePress } = ctx;

  switch (type) {
    case "measurements_overview": {
      if (history.length === 0) {
        return (
          <View style={styles.trackerEmptyCard}>
            <Text style={styles.trackerEmptyIcon}>📏</Text>
            <Text style={styles.trackerEmptyText}>No measurements yet.</Text>
            <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: colors.success, marginTop: 0, paddingHorizontal: 16 }]} onPress={() => { setSelectedLogDate(null); openMeasurementModal(); }}>
              <Text style={styles.trackerHeroButtonText}>+ Log Measurements</Text>
            </TouchableOpacity>
          </View>
        );
      }
      const latest = history[0];
      return (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Latest Measurements</Text>
          <Text style={styles.statsValue}>{`Waist: ${latest.waistCm ?? latest.waist ?? "—"} cm`}</Text>
          <Text style={styles.statsValue}>{`Left Arm: ${latest.armLeftCm ?? latest.arm_left ?? "—"} cm`}</Text>
          <Text style={styles.statsValue}>{`Right Arm: ${latest.armRightCm ?? latest.arm_right ?? "—"} cm`}</Text>
          <Text style={styles.statsValue}>{`Chest: ${latest.chestCm ?? latest.chest ?? "—"} cm`}</Text>
          <Text style={styles.statsDate}>{new Date(latest.measuredAt ?? latest.recorded_at ?? latest.date ?? "").toLocaleDateString()}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => { setSelectedLogDate(null); openMeasurementModal(); }}>
            <Text style={styles.primaryButtonText}>+ Log Measurements</Text>
          </TouchableOpacity>
        </View>
      );
    }

    case "measurements_calendar":
      return <UniversalCalendar hasDataOnDate={hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "measurements")} initialView="month" legendText="Measurements logged · tap any day to view/add" dotColor={colors.success} />;

    case "measurements_history": {
      if (history.length === 0) {
        return (
          <View style={styles.trackerEmptyCard}>
            <Text style={styles.trackerEmptyIcon}>📏</Text>
            <Text style={styles.trackerEmptyText}>No measurement entries yet.</Text>
            <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: colors.success, marginTop: 0, paddingHorizontal: 16 }]} onPress={() => { setSelectedLogDate(null); openMeasurementModal(); }}>
              <Text style={styles.trackerHeroButtonText}>+ Log Measurements</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <View>
          {history.map((entry: any, index: number) => (
            <View key={entry.id ?? index} style={[styles.weightEntryRow, index < history.length - 1 && styles.weightEntryRowBorder]}>
              <View>
                <Text style={styles.weightEntryDate}>{new Date(entry.measuredAt ?? entry.recorded_at ?? entry.date ?? "").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</Text>
                <Text style={styles.weightEntryTime}>{`Waist ${Number(entry.waistCm ?? entry.waist ?? 0).toFixed(1)} cm · Chest ${Number(entry.chestCm ?? entry.chest ?? 0).toFixed(1)} cm`}</Text>
              </View>
              <TouchableOpacity style={styles.deleteEntryBtn} onPress={() => deleteMeasurementEntry(entry)}>
                <Text style={styles.deleteEntryBtnText}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }

    case "measurements_chart": {
      if (customEntries.length === 0) {
        return (
          <View style={styles.trackerEmptyCard}>
            <Text style={styles.trackerEmptyIcon}>📈</Text>
            <Text style={styles.trackerEmptyText}>No measurements to chart yet.</Text>
          </View>
        );
      }
      const raw = customEntries.slice(0, 30).reverse().map((m: any) => {
        const date = new Date(m.loggedAt ?? m.recorded_at ?? m.date ?? new Date());
        return { label: date.toISOString().split("T")[0], value: parseFloat(String(m.waist ?? m.value ?? m.measurement ?? 0)) || 0 };
      });
      return <ProgressChart title="Measurements" icon="📏" data={{ labels: raw.map(r => r.label), datasets: [{ data: raw.map(r => r.value) }] }} yAxisSuffix="cm" />;
    }

    default: return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
  }
}
