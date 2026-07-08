import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  View,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import * as DocumentPicker from "expo-document-picker"
import { File as ExpoFile } from "expo-file-system"
import { useWorkout } from "../context/WorkoutContext"
import { useAuth } from "../context/AuthContext"
import { getCurrentBodyWeight } from "./TrackingScreen"
import ExerciseAnalytics from "../components/ExerciseAnalytics"
import { useAlert } from "../components/CustomAlert"
import { importStrengthLevelCSV } from "../utils/strengthLevelImport"
import type { WorkoutData, CompletedDays, WorkoutSession } from "../types/index"

export default function AnalyticsScreen(): React.JSX.Element {
  const {
    workoutData,
    selectedPerson,
    completedDays,
    isDemoMode,
    syncFromServer,
    fetchSessionHistory,
    currentSessionId,
  } = useWorkout()

  const { user } = useAuth()
  const { alert, AlertComponent } = useAlert()

  const [currentBodyWeight, setCurrentBodyWeight] = useState<number | null>(
    null,
  )
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState<boolean>(false)

  // Refs to track component mount state and prevent race conditions
  const isMountedRef = useRef<boolean>(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  // Load body weight with proper cleanup
  useEffect(() => {
    let cancelled = false

    const loadBodyWeight = async (): Promise<void> => {
      if (!user?.id) return

      try {
        const bodyWeight = await getCurrentBodyWeight(user.id)
        if (!cancelled && isMountedRef.current) {
          setCurrentBodyWeight(bodyWeight)
        }
      } catch (error) {
        if (!cancelled && isMountedRef.current) {
          console.error("Error loading body weight:", error)
          // Don't show alert for body weight - it's optional data
        }
      }
    }

    loadBodyWeight()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Load sessions when person changes
  useEffect(() => {
    if (selectedPerson) {
      loadSessions()
    }
  }, [selectedPerson])

  const loadSessions = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      // Cancel any pending request
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      const sessionsData = await fetchSessionHistory(100, true)

      if (isMountedRef.current) {
        setSessions((sessionsData as WorkoutSession[]) || []) // ← add cast
        setIsLoading(false)
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error("Error loading sessions:", error)
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to load workout sessions"
        setError(errorMessage)
        setIsLoading(false)

        alert(
          "Load Failed",
          "Unable to load your workout history. Please try again.",
          [{ text: "OK" }],
          "error",
        )
      }
    }
  }, [fetchSessionHistory, alert])

  const onRefresh = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current || refreshing) return

    setRefreshing(true)
    setError(null)

    try {
      // Sync from server first
      await syncFromServer()

      // Then reload sessions
      await loadSessions()

      if (isMountedRef.current) {
        // Optional success feedback
        // alert("Success", "Data refreshed successfully", [{ text: "OK" }], "success")
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error("Error refreshing data:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Failed to refresh data"
        setError(errorMessage)

        alert(
          "Refresh Failed",
          "Unable to refresh your data. Please check your connection and try again.",
          [{ text: "OK" }],
          "error",
        )
      }
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false)
      }
    }
  }, [syncFromServer, loadSessions, refreshing, alert])

  const handleImportCSV = useCallback(async (): Promise<void> => {
    if (!selectedPerson) {
      alert(
        "No Person Selected",
        "Select a person before importing workout history.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "public.comma-separated-values-text",
          "*/*",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      })

      if (pickerResult.canceled) return

      const fileUri = pickerResult.assets?.[0]?.uri
      if (!fileUri) return

      setIsImporting(true)

      const csvText = await new ExpoFile(fileUri).text()

      const result = await importStrengthLevelCSV(csvText, selectedPerson)

      if (result.sessionsCreated > 0 && isMountedRef.current) {
        await syncFromServer()
        await loadSessions()
      }

      if (!isMountedRef.current) return

      const summary =
        `Imported ${result.setsImported} set${result.setsImported === 1 ? "" : "s"} ` +
        `across ${result.sessionsCreated} session${result.sessionsCreated === 1 ? "" : "s"}.` +
        (result.skipped > 0 ? `\n${result.skipped} row(s) were skipped.` : "")

      alert(
        result.errors.length > 0
          ? "Import Completed with Issues"
          : "Import Successful",
        result.errors.length > 0
          ? `${summary}\n\n${result.errors.slice(0, 3).join("\n")}`
          : summary,
        [{ text: "OK" }],
        result.errors.length > 0 ? "error" : "success",
      )
    } catch (error) {
      console.error("Error importing CSV:", error)
      if (isMountedRef.current) {
        alert(
          "Import Failed",
          error instanceof Error
            ? error.message
            : "Failed to import the CSV file.",
          [{ text: "OK" }],
          "error",
        )
      }
    } finally {
      if (isMountedRef.current) {
        setIsImporting(false)
      }
    }
  }, [selectedPerson, syncFromServer, loadSessions, alert])

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={styles.importRow}>
        <TouchableOpacity
          style={[
            styles.importButton,
            isImporting && styles.importButtonDisabled,
          ]}
          onPress={handleImportCSV}
          disabled={isImporting}
          activeOpacity={0.7}
        >
          {isImporting ? (
            <ActivityIndicator size='small' color='#fff' />
          ) : (
            <Text style={styles.importButtonText}>
              📥 Import from Strength Level CSV
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <ExerciseAnalytics
        sessions={sessions}
        workoutData={workoutData}
        selectedPerson={selectedPerson}
        completedDays={completedDays}
        currentBodyWeight={currentBodyWeight}
        isDemoMode={isDemoMode}
        onRefresh={onRefresh}
        refreshing={refreshing}
        title='📊 Exercise Analytics'
        currentSessionId={currentSessionId}
        isLoading={isLoading}
        error={error}
      />
      {AlertComponent}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  importRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  importButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
})
