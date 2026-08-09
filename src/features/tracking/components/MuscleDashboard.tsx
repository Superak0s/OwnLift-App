import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@shared/context/ThemeContext";
import { domsApi, injuryApi, progressPhotoApi, personalNotesApi } from "../services";
import { MuscleGroup, MUSCLE_GROUP_LABELS, PersonalMuscleNote } from "../types/muscleRecovery";
import { FillBar } from "@shared/components/FillBar";
import ProgressChart from "@shared/components/ProgressChart";
import { getSeverityColor } from "@utils/severityColor";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface MuscleDashboardProps {
  readonly muscleGroup: MuscleGroup;
  readonly onClose: () => void;
  readonly onBack?: () => void;
}

type TabType = "soreness" | "photos" | "injuries" | "stats" | "notes";

export const MuscleDashboard: React.FC<MuscleDashboardProps> = ({
  muscleGroup,
  onClose,
  onBack,
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [activeTab, setActiveTab] = useState<TabType>("soreness");
  const [loading, setLoading] = useState(true);
  const [sorenessHistory, setSorenessHistory] = useState<any[]>([]);
  const [injuries, setInjuries] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [recoveryStats, setRecoveryStats] = useState<any>(null);
  const [personalNotes, setPersonalNotes] = useState<PersonalMuscleNote[]>([]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const muscleLabel = MUSCLE_GROUP_LABELS[muscleGroup] || muscleGroup;

  useEffect(() => {
    loadData();
  }, [muscleGroup]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sorenessResponse, injuryResponse, photoResponse, statsResponse, notesResponse] = await Promise.all([
        domsApi.getHistoryByMuscle(muscleGroup),
        injuryApi.getInjuriesByMuscle(muscleGroup),
        progressPhotoApi.getPhotosByMuscle(muscleGroup),
        domsApi.getStats(),
        personalNotesApi.getNotesByMuscle(muscleGroup),
      ]);

      const soreness = sorenessResponse?.data ?? sorenessResponse;
      const injuryList = injuryResponse?.data ?? injuryResponse;
      const photoList = photoResponse?.data ?? photoResponse;
      const stats = statsResponse?.data ?? statsResponse;
      const notes = notesResponse?.data ?? notesResponse;

      setSorenessHistory(Array.isArray(soreness) ? soreness : []);
      setInjuries(Array.isArray(injuryList) ? injuryList : []);
      setPhotos(Array.isArray(photoList) ? photoList : []);
      setRecoveryStats(stats);
      setPersonalNotes(Array.isArray(notes) ? notes : []);
    } catch (error) {
      console.error("Failed to load muscle dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentSoreness = useMemo(
    () => sorenessHistory.find((s) => s.status === "active"),
    [sorenessHistory]
  );

  const recoveryStat = useMemo(() => {
    if (!recoveryStats?.muscleRecoveryStats) return null;
    return recoveryStats.muscleRecoveryStats.find((s: any) => s.muscleGroup === muscleGroup);
  }, [recoveryStats, muscleGroup]);

  const getRecoveryTimeLabel = (days: number) => {
    const rounded = Math.round(days);
    if (rounded < 1) return "< 1 day";
    if (rounded === 1) return "1 day";
    return `${rounded} days`;
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;

    try {
      setSavingNote(true);
      const response = await personalNotesApi.createNote({
        muscleGroup,
        content: newNoteText.trim(),
      });

      const newNote = response?.data ?? response;
      if (newNote) {
        setPersonalNotes((prev) => [newNote, ...prev]);
        setNewNoteText("");
        setShowNoteInput(false);
      }
    } catch (error) {
      console.error("Failed to save note:", error);
      Alert.alert("Error", "Failed to save note. Please try again.");
    } finally {
      setSavingNote(false);
    }
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: "soreness", label: "Soreness", icon: "💪" },
    { key: "photos", label: "Photos", icon: "📸" },
    { key: "injuries", label: "Injuries", icon: "🏥" },
    { key: "stats", label: "Stats", icon: "📊" },
    { key: "notes", label: "Notes", icon: "📝" },
  ];

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
          Loading muscle data...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack || onClose} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.muscleName, { color: colors.textPrimary }]}>
            {muscleLabel}
          </Text>
          <Text style={[styles.muscleSubtitle, { color: colors.textSecondary }]}>
            Muscle Dashboard
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeButtonText, { color: colors.textPrimary }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Current Soreness Quick View */}
      {currentSoreness && (
        <View style={[styles.currentSorenessCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.currentSorenessLabel, { color: colors.textSecondary }]}>
            Currently Sore
          </Text>
          <View style={styles.currentSorenessRow}>
            <View style={styles.intensityBadge}>
              <FillBar
                percentage={(currentSoreness.intensity / 10) * 100}
                color={getSeverityColor(currentSoreness.intensity)}
                styles={{ track: styles.intensityBar, fill: styles.intensityBarFill }}
              />
              <Text style={[styles.intensityText, { color: colors.textPrimary }]}>
                {currentSoreness.intensity}/10
              </Text>
            </View>
            <Text style={[styles.sorenessDate, { color: colors.textSecondary }]}>
              Since {new Date(currentSoreness.loggedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tab.key ? colors.accent : colors.surface,
              },
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab.key ? "white" : colors.textPrimary },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === "soreness" && (
        <FlatList
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          data={sorenessHistory}
          keyExtractor={(entry) => String(entry.id)}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Soreness History
            </Text>
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No soreness recorded for this muscle
            </Text>
          }
          renderItem={({ item: entry }) => (
            <View style={[styles.sorenessCard, { backgroundColor: colors.surface }]}>
              <View style={styles.sorenessHeader}>
                <Text style={[styles.sorenessDateText, { color: colors.textSecondary }]}>
                  {new Date(entry.loggedAt).toLocaleDateString()}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        entry.status === "active"
                          ? "#FF6B6B"
                          : entry.status === "recovering"
                          ? "#FFD93D"
                          : "#6BCB77",
                    },
                  ]}
                >
                  <Text style={styles.statusText}>{entry.status}</Text>
                </View>
              </View>
              <View style={styles.sorenessRow}>
                <Text style={[styles.sorenessLabel, { color: colors.textSecondary }]}>
                  Intensity:
                </Text>
                <View style={styles.intensityBadge}>
                  <FillBar
                    percentage={(entry.intensity / 10) * 100}
                    color={getSeverityColor(entry.intensity)}
                    styles={{ track: styles.intensityBar, fill: styles.intensityBarFill }}
                  />
                  <Text style={[styles.intensityText, { color: colors.textPrimary }]}>
                    {entry.intensity}/10
                  </Text>
                </View>
              </View>
              {entry.notes && (
                <Text style={[styles.sorenessNotes, { color: colors.textSecondary }]}>
                  {entry.notes}
                </Text>
              )}
              {entry.followUps && entry.followUps.length > 0 && (
                <View style={styles.followUpsSection}>
                  <Text style={[styles.followUpsLabel, { color: colors.textSecondary }]}>
                    Follow-ups ({entry.followUps.length}):
                  </Text>
                  {entry.followUps.map((fu: any, idx: number) => (
                    <View key={idx} style={styles.followUpRow}>
                      <Text style={[styles.followUpDate, { color: colors.textSecondary }]}>
                        {new Date(fu.date).toLocaleDateString()}:
                      </Text>
                      <Text style={[styles.followUpStatus, { color: colors.textPrimary }]}>
                        {fu.status} - {fu.intensity}/10
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        />
      )}

      {activeTab === "photos" && (
        <FlatList
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          data={photos}
          keyExtractor={(photo) => String(photo.id)}
          numColumns={2}
          columnWrapperStyle={styles.photoGrid}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Progress Photos
            </Text>
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No photos for this muscle yet
            </Text>
          }
          renderItem={({ item: photo }) => (
            <View style={[styles.photoCard, { backgroundColor: colors.surface }]}>
              <Image
                source={{ uri: photo.uri }}
                style={styles.photoImage}
                contentFit="cover"
              />
              <View style={styles.photoInfo}>
                <Text style={[styles.photoDate, { color: colors.textSecondary }]}>
                  {new Date(photo.dateTaken).toLocaleDateString()}
                </Text>
                <Text style={[styles.photoAngle, { color: colors.textSecondary }]}>
                  {photo.angle}
                </Text>
                {photo.notes && (
                  <Text style={[styles.photoNotes, { color: colors.textSecondary }]} numberOfLines={2}>
                    {photo.notes}
                  </Text>
                )}
              </View>
            </View>
          )}
        />
      )}

      {activeTab === "injuries" && (
        <FlatList
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          data={injuries}
          keyExtractor={(injury) => String(injury.id)}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Injury History
            </Text>
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No injuries recorded for this muscle
            </Text>
          }
          renderItem={({ item: injury }) => (
            <View style={[styles.injuryCard, { backgroundColor: colors.surface }]}>
              <View style={styles.injuryHeader}>
                <Text style={[styles.injuryType, { color: colors.textPrimary }]}>
                  {injury.injuryType}
                </Text>
                <View
                  style={[
                    styles.injuryStatusBadge,
                    {
                      backgroundColor:
                        injury.status === "active"
                          ? "#FF6B6B"
                          : injury.status === "recovering"
                          ? "#FFD93D"
                          : "#6BCB77",
                    },
                  ]}
                >
                  <Text style={styles.injuryStatusText}>{injury.status}</Text>
                </View>
              </View>
              <View style={styles.injuryRow}>
                <Text style={[styles.injuryLabel, { color: colors.textSecondary }]}>
                  Pain Level:
                </Text>
                <Text style={[styles.injuryValue, { color: colors.textPrimary }]}>
                  {injury.painLevel}/10
                </Text>
              </View>
              <View style={styles.injuryRow}>
                <Text style={[styles.injuryLabel, { color: colors.textSecondary }]}>
                  Date:
                </Text>
                <Text style={[styles.injuryValue, { color: colors.textPrimary }]}>
                  {new Date(injury.dateLogged).toLocaleDateString()}
                </Text>
              </View>
              {injury.notes && (
                <Text style={[styles.injuryNotes, { color: colors.textSecondary }]}>
                  {injury.notes}
                </Text>
              )}
            </View>
          )}
        />
      )}

      {activeTab === "stats" && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Recovery Statistics
            </Text>
            {!recoveryStat ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No statistics available yet
              </Text>
            ) : (
              <View>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.statRow}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.accent }]}>
                        {recoveryStat.totalEpisodes}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Total Episodes
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.accent }]}>
                        {recoveryStat.averageRecoveryDays
                          ? getRecoveryTimeLabel(recoveryStat.averageRecoveryDays)
                          : "N/A"}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Avg Recovery
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statRow}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.accent }]}>
                        {recoveryStat.averageSeverity?.toFixed(1) || "N/A"}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Avg Severity
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.accent }]}>
                        {recoveryStat.lastSorenessDate
                          ? new Date(recoveryStat.lastSorenessDate).toLocaleDateString()
                          : "Never"}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Last Soreness
                      </Text>
                    </View>
                  </View>
                </View>

                {recoveryStat.severityTrend && recoveryStat.severityTrend.length > 0 && (
                  <View style={[styles.trendCard, { backgroundColor: colors.surface }]}>
                    <ProgressChart
                      title="Severity Trend"
                      chartType="bar"
                      chartWidth={SCREEN_WIDTH - 96}
                      barColors={recoveryStat.severityTrend
                        .slice(-7)
                        .map((point: any) => getSeverityColor(point.averageIntensity, 3))}
                      data={{
                        labels: recoveryStat.severityTrend
                          .slice(-7)
                          .map((point: any) => String(new Date(point.date).getDate())),
                        datasets: [
                          {
                            data: recoveryStat.severityTrend
                              .slice(-7)
                              .map((point: any) => point.averageIntensity),
                          },
                        ],
                      }}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {activeTab === "notes" && (
        <FlatList
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          data={personalNotes}
          keyExtractor={(note) => String(note.id)}
          ListHeaderComponent={
            <>
              <View style={styles.notesHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Personal Notes
                </Text>
                <TouchableOpacity
                  style={[styles.addNoteButton, { backgroundColor: colors.accent }]}
                  onPress={() => setShowNoteInput(!showNoteInput)}
                >
                  <Text style={styles.addNoteButtonText}>
                    {showNoteInput ? "Cancel" : "+ Add Note"}
                  </Text>
                </TouchableOpacity>
              </View>

              {showNoteInput && (
                <View style={[styles.noteInputCard, { backgroundColor: colors.surface }]}>
                  <TextInput
                    style={[styles.noteInput, { color: colors.textPrimary, borderColor: colors.inputBorder }]}
                    placeholder="Write a note about this muscle..."
                    placeholderTextColor={colors.textSecondary}
                    value={newNoteText}
                    onChangeText={setNewNoteText}
                    multiline
                    numberOfLines={4}
                  />
                  <View style={styles.noteInputActions}>
                    <TouchableOpacity
                      style={[styles.saveNoteButton, { backgroundColor: colors.accent, opacity: savingNote ? 0.6 : 1 }]}
                      onPress={handleAddNote}
                      disabled={savingNote || !newNoteText.trim()}
                    >
                      {savingNote ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.saveNoteButtonText}>Save Note</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No notes for this muscle yet
            </Text>
          }
          renderItem={({ item: note }) => (
            <View style={[styles.noteCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.noteContent, { color: colors.textPrimary }]}>
                {note.content}
              </Text>
              <Text style={[styles.noteDate, { color: colors.textSecondary }]}>
                {new Date(note.createdAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#00000015",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  muscleName: {
    fontSize: 20,
    fontWeight: "700",
  },
  muscleSubtitle: {
    fontSize: 12,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: "600",
  },
  currentSorenessCard: {
    margin: 16,
    padding: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentSorenessLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  currentSorenessRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  intensityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  intensityBar: {
    width: 100,
    height: 8,
    borderRadius: 4,
    minWidth: 20,
  },
  intensityBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  intensityText: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 35,
  },
  sorenessDate: {
    fontSize: 12,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 20,
  },
  sorenessCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sorenessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sorenessDateText: {
    fontSize: 14,
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  sorenessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sorenessLabel: {
    fontSize: 14,
  },
  sorenessNotes: {
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 4,
  },
  followUpsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#00000015",
  },
  followUpsLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  followUpRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 2,
  },
  followUpDate: {
    fontSize: 12,
  },
  followUpStatus: {
    fontSize: 12,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoCard: {
    width: "47%",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  photoImage: {
    width: "100%",
    height: 150,
  },
  photoInfo: {
    padding: 8,
  },
  photoDate: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  photoAngle: {
    fontSize: 11,
    marginBottom: 2,
  },
  photoNotes: {
    fontSize: 11,
  },
  injuryCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  injuryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  injuryType: {
    fontSize: 16,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  injuryStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  injuryStatusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  injuryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  injuryLabel: {
    fontSize: 13,
  },
  injuryValue: {
    fontSize: 13,
    fontWeight: "500",
  },
  injuryNotes: {
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 6,
  },
  noteCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noteContent: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  noteDate: {
    fontSize: 12,
    fontStyle: "italic",
  },
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addNoteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addNoteButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  noteInputCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  noteInputActions: {
    marginTop: 10,
    alignItems: "flex-end",
  },
  saveNoteButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveNoteButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  statCard: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  trendCard: {
    borderRadius: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default MuscleDashboard;
