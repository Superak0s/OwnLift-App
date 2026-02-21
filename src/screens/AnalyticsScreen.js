import React, { useState, useEffect } from "react"
import { View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useWorkout } from "../context/WorkoutContext"
import { useAuth } from "../context/AuthContext"
import { getCurrentBodyWeight } from "./TrackingScreen"
import ExerciseAnalytics from "../components/ExerciseAnalytics"

export default function AnalyticsScreen() {
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
  const [currentBodyWeight, setCurrentBodyWeight] = useState(null)
  const [sessions, setSessions] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const loadBodyWeight = async () => {
      if (user?.id) {
        const bodyWeight = await getCurrentBodyWeight(user.id)
        setCurrentBodyWeight(bodyWeight)
      }
    }
    loadBodyWeight()
  }, [user?.id])

  useEffect(() => {
    if (selectedPerson) {
      loadSessions()
    }
  }, [selectedPerson]) // was []

  const loadSessions = async () => {
    try {
      const sessionsData = await fetchSessionHistory(100, true) // add true
      setSessions(sessionsData || [])
    } catch (error) {
      console.error("Error loading sessions:", error)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await syncFromServer()
      await loadSessions()
    } catch (error) {
      // Error handled silently
    } finally {
      setRefreshing(false)
    }
  }

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
      />
    </SafeAreaView>
  )
}
