import React, { useState, useEffect, useCallback, useRef } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useWorkout } from "../context/WorkoutContext"
import { useAuth } from "../context/AuthContext"
import { getCurrentBodyWeight } from "./TrackingScreen"
import ExerciseAnalytics from "../components/ExerciseAnalytics"
import { useAlert } from "../components/CustomAlert"
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

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
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
