import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import UniversalCalendar from "@shared/components/UniversalCalendar";

export interface BodyFatRenderCtx {
  history: any[];
  height: { height_cm?: number } | null;
  heightUnit: string;
  setHeightUnit: (u: string) => void;
  openHeightModal: () => void;
  closeHeightModal: () => void;
  setNewHeightCm: (v: string) => void;
  setNewHeightFt: (v: string) => void;
  setNewHeightIn: (v: string) => void;
  openBodyFatModal: () => void;
  setSelectedLogDate: (date: Date | null) => void;
  deleteBodyFatEntry: (entry: any) => void;
  hasDataOnDate: (date: Date) => boolean;
  styles: any;
  handleCalendarDatePress: (date: Date, type: string) => void;
}

export function renderBodyFatWidget(type: string, ctx: BodyFatRenderCtx): React.ReactNode {
  const { history, height, heightUnit, setHeightUnit, openHeightModal, closeHeightModal, setNewHeightCm, setNewHeightFt, setNewHeightIn, openBodyFatModal, setSelectedLogDate, deleteBodyFatEntry, hasDataOnDate, styles, handleCalendarDatePress } = ctx;

  switch (type) {
    case "bodyfat_height": {
      return (
        <View style={styles.heightCard}>
          {height?.height_cm ? (
            <View style={styles.heightDisplay}>
              <View style={styles.heightInfo}>
                <Text style={styles.heightLabel}>Your Height</Text>
                <Text style={styles.heightValue}>{heightUnit === "cm" ? `${height.height_cm.toFixed(1)} cm` : `${Math.floor(height.height_cm / 2.54 / 12)}' ${Math.round((height.height_cm / 2.54) % 12)}"`}</Text>
                <Text style={styles.heightNote}>Required for body fat calculation</Text>
              </View>
              <TouchableOpacity style={styles.heightEditButton} onPress={() => { if (height?.height_cm) { if (heightUnit === "cm") setNewHeightCm(String(height.height_cm.toFixed(1))); else { const ti = height.height_cm / 2.54; setNewHeightFt(String(Math.floor(ti / 12))); setNewHeightIn(String(Math.round(ti % 12))); } } openHeightModal(); }}>
                <Text style={styles.heightEditButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.heightSetButton} onPress={() => openHeightModal()}>
              <Text style={styles.heightSetIcon}>📏</Text>
              <View style={styles.heightSetTextContainer}>
                <Text style={styles.heightSetTitle}>Set Your Height</Text>
                <Text style={styles.heightSetSubtitle}>Required to calculate body fat percentage</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    case "bodyfat_calendar":
      return <UniversalCalendar hasDataOnDate={hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "bodyfat")} initialView="month" legendText="Measurement taken · tap any day to view/add" dotColor="#8b5cf6" />;

    case "bodyfat_latest": {
      return (
        <View>
          {history.length > 0 ? (
            <View style={styles.bodyFatCard}>
              <Text style={styles.bodyFatLabel}>Latest Measurement</Text>
              <Text style={styles.bodyFatValue}>{Number(history[0].percentage ?? (history[0] as any).body_fat_percentage ?? 0).toFixed(1)}%</Text>
              <Text style={styles.bodyFatDate}>{new Date(history[0].date ?? history[0].recorded_at ?? "").toLocaleDateString()}</Text>
              <Text style={styles.bodyFatMethod}>US Navy Method</Text>
              <TouchableOpacity style={styles.bodyFatDeleteBtn} onPress={() => deleteBodyFatEntry(history[0])}>
                <Text style={styles.bodyFatDeleteBtnText}>🗑 Delete this reading</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.widgetLineMuted}>No body fat measurements yet.</Text>
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={() => { setSelectedLogDate(null); openBodyFatModal(); }}>
            <Text style={styles.primaryButtonText}>📐 Calculate Body Fat</Text>
          </TouchableOpacity>
        </View>
      );
    }

    default: return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
  }
}
