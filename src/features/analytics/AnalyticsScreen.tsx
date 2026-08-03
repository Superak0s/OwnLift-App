import React, { useState, useEffect, useCallback, useRef } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useWorkout } from "@shared/context/WorkoutContext"
import { useAuth } from "@shared/context/AuthContext"
import { useAlert } from "@shared/components/CustomAlert"
import ExerciseAnalytics from "./components/ExerciseAnalytics"
import type { FullSessionWithGroups } from "@shared/types"
import { getCurrentBodyWeight } from "@features/tracking/services"

export default function AnalyticsScreen(): React.JSX.Element {
  const {
    workoutData,
    selectedSplit,
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
  const [sessions, setSessions] = useState<FullSessionWithGroups[]>([])
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef<boolean>(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

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
        }
      }
    }

    loadBodyWeight()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (selectedSplit) {
      loadSessions()
    }
  }, [selectedSplit])

  const loadSessions = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      const sessionsData = await fetchSessionHistory(100, true)

      if (isMountedRef.current) {
        setSessions((sessionsData as FullSessionWithGroups[]) || [])
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
      await syncFromServer()
      await loadSessions()
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
        selectedSplit={selectedSplit}
        completedDays={completedDays}
        currentBodyWeight={currentBodyWeight}
        isDemoMode={isDemoMode}
        onRefresh={onRefresh}
        refreshing={refreshing}
        title='📊 Exercise Analytics'
        currentSessionId={currentSessionId}
        isLoading={isLoading}
        error={error}
        userId={user?.id ?? null}
      />
      {AlertComponent}
    </SafeAreaView>
  )
}
