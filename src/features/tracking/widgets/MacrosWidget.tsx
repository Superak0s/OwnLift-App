import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import UniversalCalendar from "@shared/components/UniversalCalendar";

export interface MacrosRenderCtx {
  entries: any[];
  goals: { calories: number; protein: number; carbs: number; fat: number };
  openMacrosModal: () => void;
  openGoalModal: () => void;
  setSelectedLogDate: (date: Date | null) => void;
  dailyStats: any;
  hasDataOnDate: (date: Date) => boolean;
  colors: any;
  styles: any;
  handleCalendarDatePress: (date: Date, type: string) => void;
}

export function renderMacrosWidget(type: string, ctx: MacrosRenderCtx): React.ReactNode {
  const { goals, openMacrosModal, openGoalModal, setSelectedLogDate, dailyStats, hasDataOnDate, colors, styles, handleCalendarDatePress } = ctx;

  switch (type) {
    case "macros_calendar":
      return <UniversalCalendar hasDataOnDate={hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "macros")} initialView="month" legendText="Macros logged · tap any day to view/add" dotColor={colors.error} />;

    case "macros_today": {
      const todayStats = dailyStats;
      return (
        <View>
          <TouchableOpacity style={styles.goalButton} onPress={openGoalModal}>
            <Text style={styles.goalButtonText}>{goals.calories} kcal goal</Text>
          </TouchableOpacity>
          {todayStats ? (
            <View style={styles.macrosStatsCard}>
              <Text style={styles.macrosStatsTitle}>Today's Intake</Text>
              {([
                { key: "calories", label: "Calories", unit: "kcal", color: colors.warning },
                { key: "protein", label: "Protein", unit: "g", color: colors.accent },
                { key: "carbs", label: "Carbs", unit: "g", color: colors.success },
                { key: "fat", label: "Fat", unit: "g", color: colors.error },
              ] as const).filter(({ key }) => todayStats[key] != null).map(({ key, label, unit, color }) => {
                const macro = todayStats[key]!;
                return (
                  <View key={key} style={styles.macroRow}>
                    <View style={styles.macroLabelRow}>
                      <Text style={styles.macroLabel}>{label}</Text>
                      <Text style={styles.macroValue}>{macro.total.toFixed(0)}{unit} <Text style={styles.macroRange}> ({macro.min.toFixed(0)}–{macro.max.toFixed(0)})</Text></Text>
                    </View>
                    <View style={styles.macroProgressBar}>
                      <View style={[styles.macroProgressFill, { width: `${Math.min(macro.percentage, 100)}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={styles.macroProgressText}>{macro.percentage.toFixed(0)}% of {macro.goal}{unit} goal</Text>
                  </View>
                );
              })}
              {todayStats.protein && todayStats.calories && todayStats.calories.total > 0 && (
                <Text style={styles.macrosEntriesCount}>
                  {((todayStats.protein.total / todayStats.calories.total) * 100).toFixed(1)}g protein / 100 kcal
                </Text>
              )}
              <Text style={styles.macrosEntriesCount}>{todayStats.entries} {todayStats.entries === 1 ? "entry" : "entries"} logged</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No macros logged today</Text>
            </View>
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={() => { setSelectedLogDate(null); openMacrosModal(); }}>
            <Text style={styles.primaryButtonText}>+ Log Macros</Text>
          </TouchableOpacity>
        </View>
      );
    }

    default: return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
  }
}
