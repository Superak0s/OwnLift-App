// src/features/tracking/tabs/PhotosTab.tsx
//
// Photos tab - contains all widget definitions, registry, defaults, and
// component implementations for the progress photos functionality.
//
//   1. PhotosCalendar — calendar grid showing days you've taken photos
//   2. PhotosGallery — recent photos grouped by day with quick capture
//   3. PhotosComparison — side-by-side comparison of two dates
//   4. PhotosMuscleNotes — photos with muscle group notes
//   5. PhotosMuscleView — photos organized by muscle group

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@shared/context/ThemeContext";
import { progressPhotoApi } from "../services";
import { ProgressPhotoMuscle, MUSCLE_GROUP_LABELS } from "../types/muscleRecovery";
import { STORAGE_KEYS } from "@shared/services/storage";
import { LogProgressPhotoModal } from "../components/LogProgressPhotoModal";
import type { WidgetDefinition, WidgetInstance } from "@shared/types";

// ─── Photos tab widget types ────────────────────────────────────────────────

export type PhotosWidgetType =
  | "photos_calendar"
  | "photos_gallery"
  | "photos_comparison"
  | "photos_muscle_notes"
  | "photos_muscle_view";

export const PHOTOS_WIDGET_REGISTRY: Record<
  PhotosWidgetType,
  WidgetDefinition<PhotosWidgetType>
> = {
  photos_calendar: {
    type: "photos_calendar",
    title: "Photos Calendar",
    description: "Calendar view of days you've taken progress photos",
    icon: "📅",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  photos_gallery: {
    type: "photos_gallery",
    title: "Progress Photos",
    description: "Recent progress photos grouped by day, with quick capture",
    icon: "📸",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  photos_comparison: {
    type: "photos_comparison",
    title: "Side-by-Side Comparison",
    description: "Compare two progress photos from different dates",
    icon: "🔄",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  photos_muscle_notes: {
    type: "photos_muscle_notes",
    title: "Photo Notes",
    description: "Browse photos with muscle group notes",
    icon: "📝",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  photos_muscle_view: {
    type: "photos_muscle_view",
    title: "Photos by Muscle",
    description: "View photos organized by muscle group",
    icon: "💪",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
};

export const DEFAULT_PHOTOS_WIDGETS: WidgetInstance<PhotosWidgetType>[] = [
  {
    id: "default-photos-calendar",
    type: "photos_calendar",
    size: "large",
    order: 0,
  },
  {
    id: "default-photos-gallery",
    type: "photos_gallery",
    size: "large",
    order: 1,
  },
];

export const PHOTOS_WIDGETS_STORAGE_KEY = STORAGE_KEYS.PHOTOS_TAB_WIDGETS;

// ─── Widget Components ──────────────────────────────────────────────────────

// ─── Widget: Photos Calendar ────────────────────────────────────────────────

export function PhotosCalendarWidget() {
  const { colors } = useTheme();
  const [photos, setPhotos] = useState<ProgressPhotoMuscle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await progressPhotoApi.getAllPhotos();
      setPhotos(Array.isArray(response?.data ?? response) ? (response?.data ?? response) : []);
    } catch (error) {
      console.error("Failed to load photos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const photoDates = useMemo(() => {
    const dateMap = new Map<string, number>();
    for (const photo of photos) {
      const dateKey = new Date(photo.takenAt ?? photo.taken_at ?? photo.createdAt ?? new Date()).toISOString().split("T")[0];
      dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + 1);
    }
    return dateMap;
  }, [photos]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.widgetTitle, { color: colors.textPrimary }]}>
        Photo Calendar
      </Text>
      {photoDates.size === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No photos taken yet. Take your first progress photo!
        </Text>
      ) : (
        Array.from(photoDates.entries()).map(([date, count]) => (
          <TouchableOpacity
            key={date}
            style={[styles.dateRow, { backgroundColor: colors.surface, borderColor: colors.inputBorder }]}
          >
            <View style={styles.dateInfo}>
              <Text style={[styles.dateText, { color: colors.textPrimary }]}>
                {new Date(date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
              <Text style={[styles.photoCount, { color: colors.textSecondary }]}>
                {count} photo{count > 1 ? "s" : ""}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

// ─── Widget: Photos Gallery ─────────────────────────────────────────────────

export function PhotosGalleryWidget() {
  const { colors } = useTheme();
  const [photos, setPhotos] = useState<ProgressPhotoMuscle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await progressPhotoApi.getAllPhotos();
      setPhotos(Array.isArray(response?.data ?? response) ? (response?.data ?? response) : []);
    } catch (error) {
      console.error("Failed to load photos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const photosByDate = useMemo(() => {
    const map = new Map<string, ProgressPhotoMuscle[]>();
    for (const photo of photos.sort((a, b) => new Date(b.takenAt ?? b.taken_at ?? b.createdAt ?? 0).getTime() - new Date(a.takenAt ?? a.taken_at ?? a.createdAt ?? 0).getTime())) {
      const dateKey = new Date(photo.takenAt ?? photo.taken_at ?? photo.createdAt ?? new Date()).toISOString().split("T")[0];
      const list = map.get(dateKey) ?? [];
      list.push(photo);
      map.set(dateKey, list);
    }
    return map;
  }, [photos]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.galleryHeader}>
        <Text style={[styles.widgetTitle, { color: colors.textPrimary }]}>
          Progress Photos
        </Text>
        <TouchableOpacity
          style={[styles.captureButton, { backgroundColor: colors.accent }]}
          onPress={() => setShowUploadModal(true)}
        >
          <Text style={styles.captureButtonText}>📸 Capture</Text>
        </TouchableOpacity>
      </View>
      {photos.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No photos yet. Tap Capture to take your first progress photo!
        </Text>
      ) : (
        Array.from(photosByDate.entries()).map(([date, dayPhotos]) => (
          <View key={date} style={styles.photoGroup}>
            <Text style={[styles.groupDate, { color: colors.textSecondary }]}>
              {new Date(date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
            <View style={styles.photoGrid}>
              {dayPhotos.map((photo) => (
                <View key={photo.id} style={[styles.photoCard, { backgroundColor: colors.surface }]}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoInfo}>
                    <Text style={[styles.photoAngle, { color: colors.textSecondary }]}>
                      {photo.angle}
                    </Text>
                    {photo.muscleGroups && photo.muscleGroups.length > 0 && (
                      <Text style={[styles.photoMuscles, { color: colors.accent }]}>
                        {photo.muscleGroups.map(m => MUSCLE_GROUP_LABELS[m]?.split(" ")[0] ?? m).slice(0, 3).join(", ")}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
      <LogProgressPhotoModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          setShowUploadModal(false);
          refresh();
        }}
      />
    </ScrollView>
  );
}

// ─── Widget: Photos Comparison ──────────────────────────────────────────────

export function PhotosComparisonWidget() {
  const { colors } = useTheme();
  const [photos, setPhotos] = useState<ProgressPhotoMuscle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate1, setSelectedDate1] = useState<string | null>(null);
  const [selectedDate2, setSelectedDate2] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await progressPhotoApi.getAllPhotos();
      setPhotos(Array.isArray(response?.data ?? response) ? (response?.data ?? response) : []);
    } catch (error) {
      console.error("Failed to load photos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const availableDates = useMemo(() => {
    const dateMap = new Map<string, ProgressPhotoMuscle[]>();
    for (const photo of photos.sort((a, b) => new Date(b.takenAt ?? b.taken_at ?? b.createdAt ?? 0).getTime() - new Date(a.takenAt ?? a.taken_at ?? a.createdAt ?? 0).getTime())) {
      const dateKey = new Date(photo.takenAt ?? photo.taken_at ?? photo.createdAt ?? new Date()).toISOString().split("T")[0];
      const list = dateMap.get(dateKey) ?? [];
      list.push(photo);
      dateMap.set(dateKey, list);
    }
    return Array.from(dateMap.entries());
  }, [photos]);

  const photosForDate1 = useMemo(() => {
    if (!selectedDate1) return [];
    return photos.filter(p => new Date(p.takenAt ?? p.taken_at ?? p.createdAt ?? new Date()).toISOString().split("T")[0] === selectedDate1);
  }, [photos, selectedDate1]);

  const photosForDate2 = useMemo(() => {
    if (!selectedDate2) return [];
    return photos.filter(p => new Date(p.takenAt ?? p.taken_at ?? p.createdAt ?? new Date()).toISOString().split("T")[0] === selectedDate2);
  }, [photos, selectedDate2]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.widgetTitle, { color: colors.textPrimary }]}>
        Side-by-Side Comparison
      </Text>
      <View style={styles.dateSelectors}>
        <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
          Select two dates to compare:
        </Text>
        <View style={styles.dateSelectRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
            {availableDates.map(([date]) => (
              <TouchableOpacity
                key={date}
                style={[
                  styles.datePill,
                  {
                    backgroundColor: selectedDate1 === date || selectedDate2 === date ? colors.accent : colors.surface,
                    borderColor: colors.inputBorder,
                  },
                ]}
                onPress={() => {
                  if (!selectedDate1) {
                    setSelectedDate1(date);
                  } else if (!selectedDate2) {
                    setSelectedDate2(date);
                  } else {
                    setSelectedDate1(date);
                    setSelectedDate2(null);
                  }
                }}
              >
                <Text style={[
                  styles.datePillText,
                  { color: selectedDate1 === date || selectedDate2 === date ? "white" : colors.textPrimary },
                ]}>
                  {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
      {selectedDate1 && selectedDate2 ? (
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonColumn}>
            <Text style={[styles.comparisonDate, { color: colors.textSecondary }]}>
              {new Date(selectedDate1).toLocaleDateString()}
            </Text>
            {photosForDate1.map((photo) => (
              <View key={photo.id} style={[styles.comparisonCard, { backgroundColor: colors.surface }]}>
                <Image source={{ uri: photo.uri }} style={styles.comparisonImage} resizeMode="cover" />
                <Text style={[styles.comparisonAngle, { color: colors.textSecondary }]}>{photo.angle}</Text>
              </View>
            ))}
          </View>
          <View style={styles.comparisonColumn}>
            <Text style={[styles.comparisonDate, { color: colors.textSecondary }]}>
              {new Date(selectedDate2).toLocaleDateString()}
            </Text>
            {photosForDate2.map((photo) => (
              <View key={photo.id} style={[styles.comparisonCard, { backgroundColor: colors.surface }]}>
                <Image source={{ uri: photo.uri }} style={styles.comparisonImage} resizeMode="cover" />
                <Text style={[styles.comparisonAngle, { color: colors.textSecondary }]}>{photo.angle}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
          {selectedDate1 ? "Select a second date to compare" : "Select two dates above to compare your progress"}
        </Text>
      )}
    </ScrollView>
  );
}

// ─── Widget: Photos Muscle Notes ────────────────────────────────────────────

export function PhotosMuscleNotesWidget() {
  const { colors } = useTheme();
  const [photos, setPhotos] = useState<ProgressPhotoMuscle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await progressPhotoApi.getAllPhotos();
      setPhotos(Array.isArray(response?.data ?? response) ? (response?.data ?? response) : []);
    } catch (error) {
      console.error("Failed to load photos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const photosWithNotes = useMemo(
    () => photos.filter(p => p.notes && p.notes.trim().length > 0),
    [photos]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.widgetTitle, { color: colors.textPrimary }]}>
        Photo Notes
      </Text>
      {photosWithNotes.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No photos with notes yet. Add notes when capturing photos to track your observations.
        </Text>
      ) : (
        photosWithNotes.map((photo) => (
          <View key={photo.id} style={[styles.notePhotoCard, { backgroundColor: colors.surface }]}>
            <Image source={{ uri: photo.uri }} style={styles.notePhotoImage} resizeMode="cover" />
            <View style={styles.notePhotoInfo}>
              <Text style={[styles.notePhotoDate, { color: colors.textSecondary }]}>
                {new Date(photo.takenAt ?? photo.taken_at ?? photo.createdAt ?? new Date()).toLocaleDateString()} · {photo.angle}
              </Text>
              <Text style={[styles.notePhotoText, { color: colors.textPrimary }]}>
                {photo.notes}
              </Text>
              {photo.muscleGroups && photo.muscleGroups.length > 0 && (
                <Text style={[styles.notePhotoMuscles, { color: colors.accent }]}>
                  Muscles: {photo.muscleGroups.map(m => MUSCLE_GROUP_LABELS[m]?.split(" ")[0] ?? m).join(", ")}
                </Text>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ─── Widget: Photos Muscle View ─────────────────────────────────────────────

export function PhotosMuscleViewWidget() {
  const { colors } = useTheme();
  const [photos, setPhotos] = useState<ProgressPhotoMuscle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await progressPhotoApi.getAllPhotos();
      setPhotos(Array.isArray(response?.data ?? response) ? (response?.data ?? response) : []);
    } catch (error) {
      console.error("Failed to load photos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const photosByMuscle = useMemo(() => {
    const map = new Map<string, ProgressPhotoMuscle[]>();
    for (const photo of photos) {
      if (photo.muscleGroups && photo.muscleGroups.length > 0) {
        for (const muscle of photo.muscleGroups) {
          const list = map.get(muscle) ?? [];
          list.push(photo);
          map.set(muscle, list);
        }
      }
    }
    return map;
  }, [photos]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.widgetTitle, { color: colors.textPrimary }]}>
        Photos by Muscle
      </Text>
      {photosByMuscle.size === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No photos tagged with muscles yet. Tag muscles when capturing photos.
        </Text>
      ) : (
        Array.from(photosByMuscle.entries()).map(([muscle, musclePhotos]) => (
          <View key={muscle} style={styles.muscleGroup}>
            <Text style={[styles.muscleGroupTitle, { color: colors.textPrimary }]}>
              {MUSCLE_GROUP_LABELS[muscle as keyof typeof MUSCLE_GROUP_LABELS] ?? muscle}
              <Text style={[styles.musclePhotoCount, { color: colors.textSecondary }]}>
                {" "}
                ({musclePhotos.length})
              </Text>
            </Text>
            <View style={styles.photoGrid}>
              {musclePhotos.slice(0, 4).map((photo) => (
                <View key={photo.id} style={[styles.photoCard, { backgroundColor: colors.surface }]}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <Text style={[styles.photoAngle, { color: colors.textSecondary }]}>
                    {new Date(photo.takenAt ?? photo.taken_at ?? photo.createdAt ?? new Date()).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ─── Shared Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
  },
  widgetTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateInfo: {
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "600",
  },
  photoCount: {
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
  },
  galleryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  captureButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  captureButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  photoGroup: {
    marginBottom: 24,
  },
  groupDate: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoCard: {
    width: "47%",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  photoImage: {
    width: "100%",
    height: 120,
  },
  photoInfo: {
    padding: 6,
  },
  photoAngle: {
    fontSize: 11,
    fontWeight: "500",
  },
  photoMuscles: {
    fontSize: 10,
    marginTop: 2,
  },
  dateSelectors: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  dateSelectRow: {
    flexDirection: "row",
  },
  dateScroll: {
    flex: 1,
  },
  datePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  comparisonRow: {
    flexDirection: "row",
    gap: 12,
  },
  comparisonColumn: {
    flex: 1,
  },
  comparisonDate: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  comparisonCard: {
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  comparisonImage: {
    width: "100%",
    height: 150,
  },
  comparisonAngle: {
    fontSize: 11,
    textAlign: "center",
    padding: 4,
  },
  hintText: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  notePhotoCard: {
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notePhotoImage: {
    width: "100%",
    height: 150,
  },
  notePhotoInfo: {
    padding: 10,
  },
  notePhotoDate: {
    fontSize: 11,
    marginBottom: 4,
  },
  notePhotoText: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 6,
  },
  notePhotoMuscles: {
    fontSize: 11,
    fontStyle: "italic",
  },
  muscleGroup: {
    marginBottom: 24,
  },
  muscleGroupTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  musclePhotoCount: {
    fontSize: 14,
  },
});

// ─── Tab configuration ──────────────────────────────────────────────────────

export const PHOTOS_TAB_CONFIG = {
  key: "photos",
  icon: "📸",
  label: "Photos",
};
