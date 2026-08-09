import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import UniversalCalendar from "@shared/components/UniversalCalendar";
import { HydrationSettingsWidget } from "../tabs";
import { formatDateLabel, isoToLocalDateStr } from "../utils";

export interface HydrationRenderCtx {
  entries: any[];
  goal: number;
  setGoal: (g: number) => void;
  openHydrationModal: () => void;
  setSelectedLogDate: (date: Date | null) => void;
  deleteHydrationEntry: (entry: any) => void;
  hasDataOnDate: (date: Date) => boolean;
  styles: any;
  handleCalendarDatePress: (date: Date, type: string) => void;
}

export function renderHydrationWidget(type: string, ctx: HydrationRenderCtx): React.ReactNode {
  const { entries, goal, setGoal, openHydrationModal, setSelectedLogDate, deleteHydrationEntry, hasDataOnDate, styles, handleCalendarDatePress } = ctx;

  switch (type) {
    case "hydration_overview": {
      const todayStr = isoToLocalDateStr(new Date().toISOString());
      const totalToday = entries.filter(h => isoToLocalDateStr(h?.loggedAt ?? h?.recorded_at) === todayStr).reduce((s, e) => s + (Number(e.amountMl ?? e.amount_ml ?? e.amount) || 0), 0);
      const pct = goal ? Math.min(100, Math.round((totalToday / goal) * 100)) : 0;
      return (
        <View style={[styles.trackerHeroCard, { backgroundColor: "#e0f2fe", borderColor: "#7dd3fc" }]}>
          <View style={styles.trackerHeroTop}>
            <View style={[styles.trackerHeroBadge, { backgroundColor: "#fff" }]}>
              <Text style={styles.trackerHeroBadgeIcon}>💧</Text>
            </View>
            <Text style={[styles.trackerHeroLabel, { color: "#0369a1" }]}>{pct}% of goal</Text>
          </View>
          <Text style={[styles.trackerHeroValue, { color: "#0c4a6e" }]}>{`${totalToday} / ${goal} ml`}</Text>
          <Text style={styles.trackerHeroDate}>{new Date().toLocaleDateString()}</Text>
          <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: "#0369a1" }]} onPress={() => { setSelectedLogDate(null); openHydrationModal(); }}>
            <Text style={styles.trackerHeroButtonText}>+ Log Water</Text>
          </TouchableOpacity>
        </View>
      );
    }

    case "hydration_calendar":
      return <UniversalCalendar hasDataOnDate={hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "hydration")} initialView="month" legendText="Hydration logged · tap any day to view/add" dotColor="#667eea" />;

    case "hydration_history": {
      if (entries.length === 0)
        return (
          <View style={styles.trackerEmptyCard}>
            <Text style={styles.trackerEmptyIcon}>💧</Text>
            <Text style={styles.trackerEmptyText}>No hydration entries yet.</Text>
            <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: "#0369a1", marginTop: 0, paddingHorizontal: 16 }]} onPress={() => { setSelectedLogDate(null); openHydrationModal(); }}>
              <Text style={styles.trackerHeroButtonText}>+ Log Water</Text>
            </TouchableOpacity>
          </View>
        );
      return (
        <View style={styles.trackerHistoryList}>
          {entries.map((h: any, i: number) => (
            <View key={h.id ?? i} style={[styles.trackerHistoryRow, i < entries.length - 1 && styles.trackerHistoryRowBorder]}>
              <View style={styles.trackerHistoryLeft}>
                <View style={[styles.trackerHistoryDot, { backgroundColor: "#0ea5e9" }]} />
                <View>
                  <Text style={styles.trackerHistoryDate}>{formatDateLabel(h.loggedAt ?? h.recorded_at ?? h.date ?? null)}</Text>
                  <Text style={styles.trackerHistoryTime}>{`${Number(h.amountMl ?? h.amount_ml ?? h.amount).toFixed(0)} ml`}</Text>
                </View>
              </View>
              <View style={styles.trackerHistoryRight}>
                <Text style={styles.trackerHistoryValue}>{`${Number(h.amountMl ?? h.amount_ml ?? h.amount).toFixed(0)} ml`}</Text>
                <TouchableOpacity style={styles.trackerDeleteBtn} onPress={() => deleteHydrationEntry(h)}>
                  <Text style={styles.trackerDeleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      );
    }

    case "hydration_goal":
      return <HydrationSettingsWidget onSettingsUpdate={({ goalMl }: { goalMl: number }) => setGoal(goalMl)} />;

    default: return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
  }
}
