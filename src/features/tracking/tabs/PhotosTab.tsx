// src/features/tracking/tabs/PhotosTab.tsx
//
// Photos tab - contains all widget definitions, registry, defaults, and
// component implementations for the progress photos functionality.
//
//   1. PhotosCalendar — calendar grid showing days you've taken photos
//   2. PhotosGallery — recent photos grouped by day with quick capture
//   3. PhotosComparison — side-by-side comparison of two dates

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  TextInput,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import PagerView from "react-native-pager-view";
import { useTheme } from "@shared/context/ThemeContext";
import { useAuth } from "@shared/context/AuthContext";
import { progressPhotoApi } from "../services";
import { ProgressPhotoMuscle, MUSCLE_GROUP_LABELS } from "../types/muscleRecovery";
import { STORAGE_KEYS } from "@shared/services/storage";
import { LogProgressPhotoModal } from "../components/LogProgressPhotoModal";
import ModalSheet from "@shared/components/ModalSheet";
import ZoomableImage from "@shared/components/ZoomableImage";
import type { WidgetDefinition, WidgetInstance } from "@shared/types";

// ─── Photos tab widget types ────────────────────────────────────────────────

export type PhotosWidgetType =
  | "photos_calendar"
  | "photos_gallery"
  | "photos_comparison";

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

function getAngleLabel(photo: ProgressPhotoMuscle): string {
  if (photo.angle === "custom" && photo.customSideName?.trim()) return photo.customSideName;
  return photo.angle ?? "";
}

function photoSource(uri: string | undefined, authToken: string) {
  return {
    uri,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  };
}

// ─── Widget Components ──────────────────────────────────────────────────────

// ─── Widget: Photos Calendar ────────────────────────────────────────────────

export function PhotosCalendarWidget() {
  const { colors } = useTheme();
  const { authToken } = useAuth();
  const [photos, setPhotos] = useState<ProgressPhotoMuscle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

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
    for (const photo of photos) {
      const dateKey = new Date(photo.takenAt ?? photo.taken_at ?? photo.createdAt ?? new Date()).toISOString().split("T")[0];
      const list = map.get(dateKey) ?? [];
      list.push(photo);
      map.set(dateKey, list);
    }
    return map;
  }, [photos]);

  const photoDates = photosByDate;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (photoDates.size === 0) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No photos taken yet. Take your first progress photo!
        </Text>
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={Array.from(photoDates.entries())}
      keyExtractor={([date]) => date}
      style={styles.calendarListBounded}
      contentContainerStyle={styles.scrollContent}
      renderItem={({ item: [date, dayPhotos] }) => {
        const isExpanded = expandedDate === date;
        return (
          <View>
            <TouchableOpacity
              style={[styles.dateRow, { backgroundColor: colors.surface, borderColor: colors.inputBorder }]}
              onPress={() => setExpandedDate(isExpanded ? null : date)}
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
                  {dayPhotos.length} photo{dayPhotos.length > 1 ? "s" : ""}
                </Text>
              </View>
              <Text style={styles.chevron}>{isExpanded ? "⌄" : "›"}</Text>
            </TouchableOpacity>
            {isExpanded && (
              <View style={styles.photoGrid}>
                {dayPhotos.map((photo) => (
                  <View key={photo.id} style={[styles.photoCard, { backgroundColor: colors.surface }]}>
                    <Image source={photoSource(photo.uri, authToken)} style={styles.photoImage} contentFit="cover" />
                    <View style={styles.photoInfo}>
                      <Text style={[styles.photoAngle, { color: colors.textSecondary }]}>
                        {getAngleLabel(photo)}
                      </Text>
                      {photo.muscleGroups && photo.muscleGroups.length > 0 && (
                        <Text style={[styles.photoMuscles, { color: colors.accent }]}>
                          {photo.muscleGroups.map(m => MUSCLE_GROUP_LABELS[m]?.split(" ")[0] ?? m).slice(0, 3).join(", ")}
                        </Text>
                      )}
                      {photo.notes && photo.notes.trim().length > 0 && (
                        <Text style={[styles.notePhotoMuscles, { color: colors.textPrimary }]}>
                          {photo.notes}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

// ─── Upload progress bar ─────────────────────────────────────────────────────
// Neither transport gives real byte-acked progress events (off-mode is a
// single local file copy, on-mode's photo endpoint takes no upload body at
// all — see progressPhotoApi.uploadPhoto), so there's nothing to sample
// mid-transfer. Width and MB/s are estimated from elapsed time against the
// known file size (an asymptotic ramp that never quite reaches 100% until
// the call actually resolves), which reads as genuine progress without
// claiming a precision the transport can't back up.
// ponytail: estimated, not sampled — swap for real progress events if/when
// the server gets an endpoint that actually streams the photo bytes.

export interface UploadProgressState {
  status: "uploading" | "success" | "error";
  progress: number; // 0..1
  speedMBps: number;
}

function UploadProgressBar({ state }: { readonly state: UploadProgressState }) {
  const { colors } = useTheme();
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: state.progress,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [state.progress, widthAnim]);

  const barColor = state.status === "error" ? "#FF6B6B" : colors.accent;

  return (
    <View style={uploadBarStyles.container}>
      <View style={[uploadBarStyles.track, { backgroundColor: colors.surface }]}>
        <Animated.View
          style={[
            uploadBarStyles.fill,
            {
              backgroundColor: barColor,
              width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            },
          ]}
        />
      </View>
      <Text style={[uploadBarStyles.speedText, { color: colors.textSecondary }]}>
        {state.status === "uploading"
          ? state.speedMBps > 0 ? `Uploading… ${state.speedMBps.toFixed(1)} MB/s` : "Uploading…"
          : state.status === "success"
            ? state.speedMBps > 0 ? `Uploaded · ${state.speedMBps.toFixed(1)} MB/s` : "Uploaded"
            : "Upload failed"}
      </Text>
    </View>
  );
}

const uploadBarStyles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
  speedText: {
    fontSize: 11,
    marginTop: 4,
  },
});

// ─── Widget: Photos Gallery ─────────────────────────────────────────────────

export function PhotosGalleryWidget() {
  const { colors } = useTheme();
  const { authToken } = useAuth();
  const [photos, setPhotos] = useState<ProgressPhotoMuscle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadState, setUploadState] = useState<UploadProgressState | null>(null);
  const [visibleCount, setVisibleCount] = useState(4);
  const uploadStartRef = useRef({ startedAt: 0, totalBytes: 0 });
  const uploadTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const RAMP_TAU_SEC = 2.5;
  const MAX_ESTIMATED_PROGRESS = 0.92;
  const HOLD_AFTER_DONE_MS = 5000;

  const handleUploadStart = useCallback((totalBytes: number) => {
    if (uploadTickRef.current) clearInterval(uploadTickRef.current);
    if (uploadHideRef.current) clearTimeout(uploadHideRef.current);
    uploadStartRef.current = { startedAt: Date.now(), totalBytes };
    setUploadState({ status: "uploading", progress: 0, speedMBps: 0 });

    uploadTickRef.current = setInterval(() => {
      const { startedAt, totalBytes: bytes } = uploadStartRef.current;
      const elapsedSec = (Date.now() - startedAt) / 1000;
      const progress = MAX_ESTIMATED_PROGRESS * (1 - Math.exp(-elapsedSec / RAMP_TAU_SEC));
      const speedMBps = elapsedSec > 0 ? (progress * bytes) / (1024 * 1024) / elapsedSec : 0;
      setUploadState({ status: "uploading", progress, speedMBps });
    }, 200);
  }, []);

  const handleUploadEnd = useCallback((success: boolean) => {
    if (uploadTickRef.current) {
      clearInterval(uploadTickRef.current);
      uploadTickRef.current = null;
    }
    const { startedAt, totalBytes } = uploadStartRef.current;
    const elapsedSec = Math.max((Date.now() - startedAt) / 1000, 0.05);
    const speedMBps = totalBytes / (1024 * 1024) / elapsedSec;
    setUploadState({ status: success ? "success" : "error", progress: 1, speedMBps });

    uploadHideRef.current = setTimeout(() => setUploadState(null), HOLD_AFTER_DONE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (uploadTickRef.current) clearInterval(uploadTickRef.current);
      if (uploadHideRef.current) clearTimeout(uploadHideRef.current);
    };
  }, []);

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

  const sortedPhotos = useMemo(
    () =>
      [...photos].sort((a, b) => new Date(b.takenAt ?? b.taken_at ?? b.createdAt ?? 0).getTime() - new Date(a.takenAt ?? a.taken_at ?? a.createdAt ?? 0).getTime()),
    [photos]
  );

  const visiblePhotos = useMemo(() => sortedPhotos.slice(0, visibleCount), [sortedPhotos, visibleCount]);

  const photosByDate = useMemo(() => {
    const map = new Map<string, ProgressPhotoMuscle[]>();
    for (const photo of visiblePhotos) {
      const dateKey = new Date(photo.takenAt ?? photo.taken_at ?? photo.createdAt ?? new Date()).toISOString().split("T")[0];
      const list = map.get(dateKey) ?? [];
      list.push(photo);
      map.set(dateKey, list);
    }
    return map;
  }, [visiblePhotos]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.scrollContent}
      data={Array.from(photosByDate.entries())}
      keyExtractor={([date]) => date}
      ListHeaderComponent={
        <>
          <View style={[styles.galleryHeader, { justifyContent: "flex-end" }]}>
            <TouchableOpacity
              style={[styles.captureButton, { backgroundColor: colors.accent }]}
              onPress={() => setShowUploadModal(true)}
            >
              <Text style={styles.captureButtonText}>📸 Capture</Text>
            </TouchableOpacity>
          </View>
          {uploadState && <UploadProgressBar state={uploadState} />}
        </>
      }
      ListEmptyComponent={
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No photos yet. Tap Capture to take your first progress photo!
        </Text>
      }
      renderItem={({ item: [date, dayPhotos] }) => (
        <View style={styles.photoGroup}>
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
                  source={photoSource(photo.uri, authToken)}
                  style={styles.photoImage}
                  contentFit="cover"
                />
                <View style={styles.photoInfo}>
                  <Text style={[styles.photoAngle, { color: colors.textSecondary }]}>
                    {getAngleLabel(photo)}
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
      )}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (visibleCount < sortedPhotos.length) setVisibleCount((c) => c + 4);
      }}
      ListFooterComponent={
        <LogProgressPhotoModal
          visible={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            setVisibleCount(4);
            refresh();
          }}
          onUploadStart={handleUploadStart}
          onUploadEnd={handleUploadEnd}
        />
      }
    />
  );
}

// ─── Widget: Photos Comparison ──────────────────────────────────────────────

export function PhotosComparisonWidget() {
  const { colors } = useTheme();
  const [showModal, setShowModal] = useState(false);

  return (
    <View style={styles.comparisonLauncher}>
      <Text style={[styles.hintText, { color: colors.textSecondary }]}>
        Filter and compare two progress photos from different dates.
      </Text>
      <TouchableOpacity
        style={[styles.captureButton, { backgroundColor: colors.accent, alignSelf: "flex-start" }]}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.captureButtonText}>🔄 Open Comparison</Text>
      </TouchableOpacity>
      <PhotosComparisonModal visible={showModal} onClose={() => setShowModal(false)} />
    </View>
  );
}

function PhotosComparisonModal({ visible, onClose }: { readonly visible: boolean; readonly onClose: () => void }) {
  const { colors } = useTheme();
  const { authToken } = useAuth();
  const [photos, setPhotos] = useState<ProgressPhotoMuscle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate1, setSelectedDate1] = useState<string | null>(null);
  const [selectedDate2, setSelectedDate2] = useState<string | null>(null);
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [muscleSearch, setMuscleSearch] = useState("");
  const [rangeFilter, setRangeFilter] = useState<"all" | "7" | "30" | "90">("all");

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
    if (visible) refresh();
  }, [visible, refresh]);

  const availableMuscles = useMemo(() => {
    const set = new Set<string>();
    for (const photo of photos) {
      for (const m of photo.muscleGroups ?? []) set.add(m);
    }
    return Array.from(set);
  }, [photos]);

  const filteredMuscleOptions = useMemo(() => {
    const query = muscleSearch.trim().toLowerCase();
    if (!query) return availableMuscles;
    return availableMuscles.filter((muscle) =>
      (MUSCLE_GROUP_LABELS[muscle as keyof typeof MUSCLE_GROUP_LABELS] ?? muscle).toLowerCase().includes(query)
    );
  }, [availableMuscles, muscleSearch]);

  const filteredPhotos = useMemo(() => {
    const cutoffMs = rangeFilter === "all" ? null : Date.now() - Number(rangeFilter) * 24 * 60 * 60 * 1000;
    return photos.filter((p) => {
      if (muscleFilter && !p.muscleGroups?.includes(muscleFilter as any)) return false;
      if (cutoffMs !== null) {
        const t = new Date(p.takenAt ?? p.taken_at ?? p.createdAt ?? 0).getTime();
        if (t < cutoffMs) return false;
      }
      return true;
    });
  }, [photos, muscleFilter, rangeFilter]);

  const availableDates = useMemo(() => {
    const dateMap = new Map<string, ProgressPhotoMuscle[]>();
    for (const photo of filteredPhotos.sort((a, b) => new Date(b.takenAt ?? b.taken_at ?? b.createdAt ?? 0).getTime() - new Date(a.takenAt ?? a.taken_at ?? a.createdAt ?? 0).getTime())) {
      const dateKey = new Date(photo.takenAt ?? photo.taken_at ?? photo.createdAt ?? new Date()).toISOString().split("T")[0];
      const list = dateMap.get(dateKey) ?? [];
      list.push(photo);
      dateMap.set(dateKey, list);
    }
    return Array.from(dateMap.entries());
  }, [filteredPhotos]);

  const photosForDate1 = useMemo(() => {
    if (!selectedDate1) return [];
    return filteredPhotos.filter(p => new Date(p.takenAt ?? p.taken_at ?? p.createdAt ?? new Date()).toISOString().split("T")[0] === selectedDate1);
  }, [filteredPhotos, selectedDate1]);

  const photosForDate2 = useMemo(() => {
    if (!selectedDate2) return [];
    return filteredPhotos.filter(p => new Date(p.takenAt ?? p.taken_at ?? p.createdAt ?? new Date()).toISOString().split("T")[0] === selectedDate2);
  }, [filteredPhotos, selectedDate2]);

  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  return (
    <ModalSheet
      visible={visible}
      title="Side-by-Side Comparison"
      onClose={onClose}
      showCancelButton={false}
      showConfirmButton={false}
      scrollable
      fullHeight
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <>
          <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
            Filters
          </Text>
          <View style={styles.filterRow}>
            {(["all", "7", "30", "90"] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.filterPill,
                  { backgroundColor: rangeFilter === range ? colors.accent : colors.surface, borderColor: colors.inputBorder },
                ]}
                onPress={() => setRangeFilter(range)}
              >
                <Text style={[styles.filterPillText, { color: rangeFilter === range ? "white" : colors.textPrimary }]}>
                  {range === "all" ? "All time" : `${range}d`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {availableMuscles.length > 0 && (
            <>
              <TextInput
                style={[styles.muscleSearchInput, { backgroundColor: colors.surface, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                placeholder="Search muscle groups..."
                placeholderTextColor={colors.textMuted ?? "#888"}
                value={muscleSearch}
                onChangeText={setMuscleSearch}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    { backgroundColor: !muscleFilter ? colors.accent : colors.surface, borderColor: colors.inputBorder },
                  ]}
                  onPress={() => setMuscleFilter(null)}
                >
                  <Text style={[styles.filterPillText, { color: !muscleFilter ? "white" : colors.textPrimary }]}>All muscles</Text>
                </TouchableOpacity>
                {filteredMuscleOptions.map((muscle) => (
                  <TouchableOpacity
                    key={muscle}
                    style={[
                      styles.filterPill,
                      { backgroundColor: muscleFilter === muscle ? colors.accent : colors.surface, borderColor: colors.inputBorder },
                    ]}
                    onPress={() => setMuscleFilter(muscleFilter === muscle ? null : muscle)}
                  >
                    <Text style={[styles.filterPillText, { color: muscleFilter === muscle ? "white" : colors.textPrimary }]}>
                      {MUSCLE_GROUP_LABELS[muscle as keyof typeof MUSCLE_GROUP_LABELS]?.split(" ")[0] ?? muscle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
          <View style={styles.dateSelectors}>
            <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
              Select two dates to compare:
            </Text>
            <View style={styles.dateSelectRow}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dateScroll}
                data={availableDates}
                keyExtractor={([date]) => date}
                renderItem={({ item: [date] }) => (
                  <TouchableOpacity
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
                )}
              />
            </View>
          </View>
          {selectedDate1 && selectedDate2 ? (
            <>
              <TouchableOpacity
                style={[styles.captureButton, { backgroundColor: colors.accent, alignSelf: "flex-start", marginBottom: 12 }]}
                onPress={() => setFullscreenOpen(true)}
              >
                <Text style={styles.captureButtonText}>🔍 Fullscreen Compare</Text>
              </TouchableOpacity>
              <View style={styles.comparisonRow}>
                <View style={styles.comparisonColumn}>
                  <Text style={[styles.comparisonDate, { color: colors.textSecondary }]}>
                    {new Date(selectedDate1).toLocaleDateString()}
                  </Text>
                  {photosForDate1.map((photo) => (
                    <TouchableOpacity key={photo.id} style={[styles.comparisonCard, { backgroundColor: colors.surface }]} onPress={() => setFullscreenOpen(true)}>
                      <Image source={photoSource(photo.uri, authToken)} style={styles.comparisonImage} contentFit="cover" />
                      <Text style={[styles.comparisonAngle, { color: colors.textSecondary }]}>{getAngleLabel(photo)}</Text>
                      {photo.notes && photo.notes.trim().length > 0 && (
                        <Text style={[styles.comparisonNotes, { color: colors.textPrimary }]}>{photo.notes}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.comparisonColumn}>
                  <Text style={[styles.comparisonDate, { color: colors.textSecondary }]}>
                    {new Date(selectedDate2).toLocaleDateString()}
                  </Text>
                  {photosForDate2.map((photo) => (
                    <TouchableOpacity key={photo.id} style={[styles.comparisonCard, { backgroundColor: colors.surface }]} onPress={() => setFullscreenOpen(true)}>
                      <Image source={photoSource(photo.uri, authToken)} style={styles.comparisonImage} contentFit="cover" />
                      <Text style={[styles.comparisonAngle, { color: colors.textSecondary }]}>{getAngleLabel(photo)}</Text>
                      {photo.notes && photo.notes.trim().length > 0 && (
                        <Text style={[styles.comparisonNotes, { color: colors.textPrimary }]}>{photo.notes}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <FullscreenCompareViewer
                visible={fullscreenOpen}
                onClose={() => setFullscreenOpen(false)}
                photosForDate1={photosForDate1}
                photosForDate2={photosForDate2}
                dateLabel1={new Date(selectedDate1).toLocaleDateString()}
                dateLabel2={new Date(selectedDate2).toLocaleDateString()}
                authToken={authToken}
              />
            </>
          ) : (
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              {selectedDate1 ? "Select a second date to compare" : "Select two dates above to compare your progress"}
            </Text>
          )}
        </>
      )}
    </ModalSheet>
  );
}

function FullscreenCompareColumn({ photos, label, authToken }: { readonly photos: ProgressPhotoMuscle[]; readonly label: string; readonly authToken: string }) {
  const [page, setPage] = useState(0);
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
  if (photos.length === 0) {
    return (
      <View style={styles.fullscreenColumn}>
        <Text style={styles.fullscreenLabel}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={styles.fullscreenColumn}>
      <Text style={styles.fullscreenLabel}>{label}</Text>
      <PagerView style={styles.fullscreenPager} initialPage={0} onPageSelected={(e) => setPage(e.nativeEvent.position)}>
        {photos.map((photo) => (
          <ZoomableImage key={photo.id} uri={photo.uri ?? ""} style={styles.fullscreenImage} headers={headers} />
        ))}
      </PagerView>
      {photos.length > 1 && (
        <View style={styles.fullscreenDots}>
          {photos.map((photo, i) => (
            <View key={photo.id} style={[styles.fullscreenDot, i === page && styles.fullscreenDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

function FullscreenCompareViewer({
  visible,
  onClose,
  photosForDate1,
  photosForDate2,
  dateLabel1,
  dateLabel2,
  authToken,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly photosForDate1: ProgressPhotoMuscle[];
  readonly photosForDate2: ProgressPhotoMuscle[];
  readonly dateLabel1: string;
  readonly dateLabel2: string;
  readonly authToken: string;
}) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent={false}>
      <View style={styles.fullscreenContainer}>
        <TouchableOpacity style={styles.fullscreenClose} onPress={onClose}>
          <Text style={styles.fullscreenCloseText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.fullscreenRow}>
          <FullscreenCompareColumn photos={photosForDate1} label={dateLabel1} authToken={authToken} />
          <FullscreenCompareColumn photos={photosForDate2} label={dateLabel2} authToken={authToken} />
        </View>
        <Text style={styles.fullscreenHint}>Pinch to zoom · double-tap to reset · swipe to browse</Text>
      </View>
    </Modal>
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
  calendarListBounded: {
    maxHeight: 480,
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
  muscleSearchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
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
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 48,
  },
  fullscreenClose: {
    position: "absolute",
    top: 48,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenCloseText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  fullscreenRow: {
    flex: 1,
    flexDirection: "row",
  },
  fullscreenColumn: {
    flex: 1,
  },
  fullscreenLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  fullscreenPager: {
    flex: 1,
  },
  fullscreenImage: {
    flex: 1,
  },
  fullscreenDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  fullscreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  fullscreenDotActive: {
    backgroundColor: "#fff",
  },
  fullscreenHint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    textAlign: "center",
    paddingVertical: 10,
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
  comparisonNotes: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  comparisonLauncher: {
    padding: 16,
  },
  hintText: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  notePhotoMuscles: {
    fontSize: 11,
    fontStyle: "italic",
  },
});

// ─── Tab configuration ──────────────────────────────────────────────────────

export const PHOTOS_TAB_CONFIG = {
  key: "photos",
  icon: "📸",
  label: "Photos",
};
