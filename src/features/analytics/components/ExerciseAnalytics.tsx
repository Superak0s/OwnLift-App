import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Dimensions,
} from "react-native"
import UniversalCalendar from "@shared/components/UniversalCalendar"
import ProgressChart from "@shared/components/ProgressChart"
import ModalSheet from "@shared/components/ModalSheet"
import type { ChartData } from "react-native-chart-kit/dist/HelperTypes"

// Canonical shared + feature types — no local redefinitions.
import type {
  WorkoutData,
  SetTiming,
  FullSessionWithGroups,
} from "@shared/types"
import { useTheme } from "@shared/context/ThemeContext"

// Analytics-only types, extracted to keep this file focused on rendering.
import type {
  CompletedSetData,
  CompletedDays,
  ExerciseMeta,
  ExerciseHistoryEntry,
  ExerciseStats,
} from "../types"

const { width: screenWidth } = Dimensions.get("window")

// Session is really just the fields ExerciseAnalytics reads from a full
// session detail — narrow it via Pick instead of duplicating the shape.
// NOTE: based on FullSessionWithGroups, not WorkoutSession — the lightweight
// summary type has no set_timings. fetchSessionHistory(100, true)'s second
// arg is what triggers the server/context to return full detail.
type Session = Pick<
  FullSessionWithGroups,
  "day_number" | "start_time" | "set_timings"
>

// ─── Props (kept local — tightly bound to this one component) ─────────────

interface ExerciseAnalyticsProps {
  sessions?: Session[]
  workoutData?: WorkoutData | null
  selectedPerson?: string | null
  completedDays?: CompletedDays
  currentBodyWeight?: number | null
  isDemoMode?: boolean
  onRefresh?: (() => void) | null
  refreshing?: boolean
  title?: string
  currentSessionId?: string | null
  isLoading?: boolean
  error?: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExerciseAnalytics({
  sessions = [],
  workoutData = null,
  selectedPerson = null,
  completedDays = {},
  currentBodyWeight = null,
  isDemoMode = false,
  onRefresh = null,
  refreshing = false,
  title = "📊 Exercise Analytics",
  currentSessionId = null,
  isLoading = false, // ← add this
  error = null, // ← add this
}: ExerciseAnalyticsProps) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [exerciseData, setExerciseData] = useState<
    ExerciseHistoryEntry[] | null
  >(null)
  const [loading, setLoading] = useState(false)
  const [availableExercises, setAvailableExercises] = useState<ExerciseMeta[]>(
    [],
  )
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showZeroSetExercises, setShowZeroSetExercises] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showDateSets, setShowDateSets] = useState(false)
  const hasAutoSelected = useRef(false)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    loadAvailableExercises()
  }, [sessions, workoutData, selectedPerson, completedDays])
  useEffect(() => {
    hasAutoSelected.current = false
  }, [selectedPerson, sessions])
  useEffect(() => {
    if (selectedExercise) loadExerciseData()
  }, [selectedExercise, completedDays, sessions])

  const fmt = (value?: number | null): string => {
    const n = parseFloat(String(value ?? 0))
    if (!isFinite(n)) return "0"
    return parseFloat(n.toFixed(2)).toString()
  }

  const resolveExerciseName = useCallback(
    (timing: SetTiming, session: Session): string => {
      if (timing.exercise_name?.trim()) return timing.exercise_name.trim()

      if (
        workoutData?.days &&
        selectedPerson &&
        timing.exercise_index != null
      ) {
        const day = workoutData.days.find(
          (d) => d.dayNumber === session.day_number,
        )
        const exercise =
          day?.people?.[selectedPerson]?.exercises?.[timing.exercise_index]
        if (exercise) {
          const ex = exercise as { machineName?: string; name: string }
          return ex.machineName ?? ex.name
        }
      }

      return timing.exercise_index != null
        ? `Exercise ${timing.exercise_index + 1}`
        : "Unknown Exercise"
    },
    [workoutData, selectedPerson],
  )

  const loadAvailableExercises = () => {
    const exercisesMap = new Map<string, ExerciseMeta>()

    if (workoutData?.days && selectedPerson) {
      workoutData.days.forEach((day) => {
        const personWorkout = day.people?.[selectedPerson]
        ;(personWorkout?.exercises ?? []).forEach((exercise, exerciseIndex) => {
          const ex = exercise as {
            machineName?: string
            name: string
            muscleGroup?: string
          }
          const key = ex.machineName ?? ex.name
          if (!exercisesMap.has(key)) {
            exercisesMap.set(key, {
              name: key,
              exerciseName: ex.name,
              machineName: ex.machineName ?? null,
              muscleGroup: ex.muscleGroup ?? null,
              days: [],
              totalSets: 0,
            })
          }
          const data = exercisesMap.get(key)!
          data.days.push({ dayNumber: day.dayNumber, exerciseIndex })

          const daySets = completedDays[day.dayNumber]?.[exerciseIndex]
          if (daySets) data.totalSets += Object.keys(daySets).length
        })
      })
    }

    sessions.forEach((session) => {
      if (!session.set_timings) return
      session.set_timings.forEach((timing) => {
        const key = resolveExerciseName(timing, session)
        if (!exercisesMap.has(key)) {
          exercisesMap.set(key, {
            name: key,
            exerciseName: key,
            machineName: null,
            muscleGroup: timing.exercise_muscle_group ?? null,
            days: [],
            totalSets: 0,
          })
        }
        exercisesMap.get(key)!.totalSets++
      })
    })

    const exercises = Array.from(exercisesMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    setAvailableExercises(exercises)

    if (exercises.length > 0 && !hasAutoSelected.current) {
      hasAutoSelected.current = true
      const firstWithData = exercises.find((e) => e.totalSets > 0)
      setSelectedExercise(firstWithData?.name ?? exercises[0]?.name ?? null)
    }
  }

  const generateDemoData = (exerciseName: string): ExerciseHistoryEntry[] => {
    const demoData: ExerciseHistoryEntry[] = []
    const today = new Date()
    const lower = exerciseName.toLowerCase()
    const baseWeight = lower.includes("bench")
      ? 60
      : lower.includes("squat")
        ? 80
        : lower.includes("deadlift")
          ? 100
          : lower.includes("press")
            ? 40
            : 50

    for (let week = 0; week < 4; week++) {
      for (let session = 0; session < 3; session++) {
        const daysAgo = (3 - week) * 7 + (2 - session) * 2
        const workoutDate = new Date(today)
        workoutDate.setDate(today.getDate() - daysAgo)
        const weeklyIncrease = week * 2.5
        const sessionVariation = (Math.random() - 0.5) * 2.5
        const numSets = 3 + Math.floor(Math.random() * 2)

        for (let set = 0; set < numSets; set++) {
          const weight = baseWeight + weeklyIncrease + sessionVariation
          const reps = Math.max(8, 10 + Math.floor(Math.random() * 3) - 1)
          demoData.push({
            date: new Date(workoutDate.getTime() + set * 1000 * 180),
            weight: Math.round(weight * 2) / 2,
            reps,
            volume: weight * reps,
            dayNumber: 1 + (week % 5),
            setNumber: set + 1,
            source: "demo",
            isAssisted: false,
          })
        }
      }
    }
    return demoData
  }

  const loadExerciseData = () => {
    if (!selectedExercise) return
    setLoading(true)
    try {
      const exerciseHistory: ExerciseHistoryEntry[] = []

      sessions.forEach((session) => {
        if (!session.set_timings?.length) return
        session.set_timings.forEach((timing) => {
          if (resolveExerciseName(timing, session) !== selectedExercise) return

          let isAssisted = false
          if (
            workoutData?.days &&
            selectedPerson &&
            timing.exercise_index != null
          ) {
            const day = workoutData.days.find(
              (d) => d.dayNumber === session.day_number,
            )
            const exercise =
              day?.people?.[selectedPerson]?.exercises?.[timing.exercise_index]
            if (exercise) {
              const ex = exercise as { name: string }
              isAssisted = ex.name.toLowerCase().includes("assisted")
            }
          }

          const rawWeight = timing.weight ?? 0
          const rawReps = timing.reps ?? 0
          const volume =
            isAssisted && currentBodyWeight
              ? (currentBodyWeight - rawWeight) * rawReps
              : rawWeight * rawReps

          exerciseHistory.push({
            date: new Date(timing.end_time ?? session.start_time ?? Date.now()),
            weight: isFinite(rawWeight) ? rawWeight : 0,
            reps: isFinite(rawReps) ? rawReps : 0,
            volume: isFinite(volume) ? volume : 0,
            dayNumber: session.day_number ?? 0,
            setNumber: (timing.set_index ?? 0) + 1,
            source: "server",
            isAssisted,
          })
        })
      })

      if (
        workoutData?.days &&
        selectedPerson &&
        Object.keys(completedDays).length > 0
      ) {
        Object.keys(completedDays).forEach((dayNumber) => {
          const day = workoutData.days!.find(
            (d) => d.dayNumber === parseInt(dayNumber),
          )
          if (!day) return
          const personWorkout = day.people?.[selectedPerson]
          if (!personWorkout?.exercises) return

          personWorkout.exercises.forEach((exercise, exerciseIndex) => {
            const ex = exercise as { machineName?: string; name: string }
            const exerciseName = ex.machineName ?? ex.name
            if (exerciseName !== selectedExercise) return
            const isAssisted = ex.name.toLowerCase().includes("assisted")
            const exerciseSets = completedDays[dayNumber]?.[exerciseIndex]
            if (!exerciseSets) return

            Object.keys(exerciseSets).forEach((setIndex) => {
              const setData = exerciseSets[setIndex as unknown as number]
              if (!setData) return
              const rawWeight = setData.weight ?? 0
              const rawReps = setData.reps ?? 0
              const volume =
                isAssisted && currentBodyWeight
                  ? (currentBodyWeight - rawWeight) * rawReps
                  : rawWeight * rawReps

              exerciseHistory.push({
                date: new Date(setData.completedAt ?? Date.now()),
                weight: isFinite(rawWeight) ? rawWeight : 0,
                reps: isFinite(rawReps) ? rawReps : 0,
                volume: isFinite(volume) ? volume : 0,
                dayNumber: parseInt(dayNumber),
                setNumber: parseInt(setIndex) + 1,
                source: "local",
                isAssisted,
              })
            })
          })
        })
      }

      if (isDemoMode && exerciseHistory.length === 0) {
        exerciseHistory.push(...generateDemoData(selectedExercise))
      }

      exerciseHistory.sort((a, b) => a.date.getTime() - b.date.getTime())

      const uniqueHistory: ExerciseHistoryEntry[] = []
      const seen = new Map<string, ExerciseHistoryEntry>()
      exerciseHistory.forEach((entry) => {
        const key = `${entry.date.getTime()}-${entry.dayNumber}-${entry.setNumber}`
        if (!seen.has(key)) {
          seen.set(key, entry)
          uniqueHistory.push(entry)
        } else {
          const existing = seen.get(key)!
          if (entry.source === "server" && existing.source === "local") {
            const index = uniqueHistory.indexOf(existing)
            uniqueHistory[index] = entry
            seen.set(key, entry)
          }
        }
      })

      setExerciseData(uniqueHistory)
    } catch (error) {
      console.error("Error loading exercise data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getChartData = (metric: "weight" | "volume" | "reps"): ChartData => {
    if (!exerciseData?.length) {
      return { labels: ["No data"], datasets: [{ data: [0] }] }
    }

    const sessionMap = new Map<
      string,
      { date: Date; weights: number[]; reps: number[]; volumes: number[] }
    >()
    exerciseData.forEach((entry) => {
      const dateKey = entry.date.toLocaleDateString()
      if (!sessionMap.has(dateKey)) {
        sessionMap.set(dateKey, {
          date: entry.date,
          weights: [],
          reps: [],
          volumes: [],
        })
      }
      const s = sessionMap.get(dateKey)!
      s.weights.push(isFinite(entry.weight) ? entry.weight : 0)
      s.reps.push(isFinite(entry.reps) ? entry.reps : 0)
      s.volumes.push(isFinite(entry.volume) ? entry.volume : 0)
    })

    const chartSessions = Array.from(sessionMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    )
    if (!chartSessions.length)
      return { labels: ["No data"], datasets: [{ data: [0] }] }

    const maxLabels = 8
    const labelInterval = Math.ceil(chartSessions.length / maxLabels)
    const labels = chartSessions.map((s, index) =>
      chartSessions.length <= maxLabels || index % labelInterval === 0
        ? s.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "",
    )

    let data: number[]
    if (metric === "weight") {
      data = chartSessions.map((s) => {
        if (!s.weights.length) return 0
        const avg = s.weights.reduce((sum, w) => sum + w, 0) / s.weights.length
        return isFinite(avg) ? Math.round(avg * 10) / 10 : 0
      })
    } else if (metric === "volume") {
      data = chartSessions.map((s) => {
        const total = s.volumes.reduce((sum, v) => sum + v, 0)
        return isFinite(total) ? Math.round(total * 10) / 10 : 0
      })
    } else {
      data = chartSessions.map((s) => {
        if (!s.reps.length) return 0
        const avg = s.reps.reduce((sum, r) => sum + r, 0) / s.reps.length
        return isFinite(avg) ? Math.round(avg * 10) / 10 : 0
      })
    }

    return {
      labels: labels.length > 0 ? labels : [""],
      datasets: [{ data: data.map((v) => (isFinite(v) ? v : 0)) }],
    }
  }

  const getStats = (): ExerciseStats => {
    const empty: ExerciseStats = {
      totalSets: 0,
      totalWorkouts: 0,
      extremeWeight: 0,
      extremeWeightLabel: "Max Weight",
      maxReps: 0,
      avgWeight: 0,
      avgReps: 0,
      totalVolume: 0,
      lastWorkout: null,
      isAssisted: false,
    }
    if (!exerciseData?.length) return empty

    const isAssisted = exerciseData[0]?.isAssisted ?? false
    const sessionDates = new Set(
      exerciseData.map((e) => e.date.toLocaleDateString()),
    )
    const weights = exerciseData.map((e) => (isFinite(e.weight) ? e.weight : 0))
    const reps = exerciseData.map((e) => (isFinite(e.reps) ? e.reps : 0))
    const volumes = exerciseData.map((e) => (isFinite(e.volume) ? e.volume : 0))
    const totalVolume = volumes.reduce((sum, v) => sum + v, 0)
    const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length
    const avgReps = reps.reduce((sum, r) => sum + r, 0) / reps.length

    return {
      totalSets: exerciseData.length,
      totalWorkouts: sessionDates.size,
      extremeWeight: isAssisted ? Math.min(...weights) : Math.max(...weights),
      extremeWeightLabel: isAssisted ? "Least Assistance" : "Max Weight",
      maxReps: Math.max(...reps),
      avgWeight: isFinite(avgWeight) ? Math.round(avgWeight * 10) / 10 : 0,
      avgReps: isFinite(avgReps) ? Math.round(avgReps * 10) / 10 : 0,
      totalVolume: isFinite(totalVolume) ? Math.round(totalVolume) : 0,
      lastWorkout: exerciseData[exerciseData.length - 1]?.date ?? null,
      isAssisted,
    }
  }

  const getSetsForDate = (date: Date): ExerciseHistoryEntry[] => {
    if (!exerciseData) return []
    const target = new Date(date)
    target.setHours(0, 0, 0, 0)
    return exerciseData.filter((set) => {
      const setDate = new Date(set.date)
      setDate.setHours(0, 0, 0, 0)
      return setDate.getTime() === target.getTime()
    })
  }

  const hasSetsOnDate = (date: Date): boolean => getSetsForDate(date).length > 0

  const handleDatePress = (date: Date) => {
    if (getSetsForDate(date).length > 0) {
      setSelectedDate(date)
      setShowDateSets(true)
    }
  }

  const formatDate = (date: Date): string =>
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })

  const formatTime = (date: Date): string =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

  const filteredExercises = availableExercises.filter((exercise) => {
    const matchesSearch =
      searchQuery.length === 0 ||
      exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exercise.muscleGroup
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ??
        false)
    const hasData = exercise.totalSets > 0 || showZeroSetExercises
    return matchesSearch && hasData
  })

  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size='large' color={colors.accent} />
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>⚠️</Text>
        <Text style={styles.emptyTitle}>Something went wrong</Text>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    )
  }

  if (!sessions?.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>No Data Available</Text>
        <Text style={styles.emptyText}>No workout sessions found</Text>
      </View>
    )
  }

  const stats = getStats()

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width - 40)}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        ) : undefined
      }
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Track progress over time</Text>
        </View>

        {isDemoMode && (
          <View style={styles.demoBanner}>
            <Text style={styles.demoBannerIcon}>🧪</Text>
            <Text style={styles.demoBannerText}>
              Demo Mode - Showing sample data
            </Text>
          </View>
        )}

        {selectedExercise &&
          availableExercises
            .find((e) => e.name === selectedExercise)
            ?.name.toLowerCase()
            .includes("assisted") &&
          !currentBodyWeight && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <View style={styles.warningTextContainer}>
                <Text style={styles.warningTitle}>Body Weight Required</Text>
                <Text style={styles.warningText}>
                  Body weight needed for accurate assisted exercise calculations
                </Text>
              </View>
            </View>
          )}

        {/* Exercise Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Exercise</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowDropdown(true)}
          >
            <View style={styles.dropdownButtonContent}>
              <View style={styles.dropdownButtonLeft}>
                <Text style={styles.dropdownButtonText}>
                  {selectedExercise ?? "Select an exercise"}
                </Text>
                {selectedExercise &&
                  availableExercises.find((e) => e.name === selectedExercise)
                    ?.muscleGroup && (
                    <Text style={styles.dropdownButtonSubtext}>
                      {
                        availableExercises.find(
                          (e) => e.name === selectedExercise,
                        )!.muscleGroup
                      }
                    </Text>
                  )}
              </View>
              <Text style={styles.dropdownArrow}>▼</Text>
            </View>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color={colors.accent} />
            <Text style={styles.loadingText}>Loading data...</Text>
          </View>
        ) : exerciseData && exerciseData.length > 0 ? (
          <>
            {/* Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalSets}</Text>
                <Text style={styles.statLabel}>Total Sets</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
                <Text style={styles.statLabel}>Workouts</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {fmt(stats.extremeWeight)}kg
                </Text>
                <Text style={styles.statLabel}>{stats.extremeWeightLabel}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.maxReps}</Text>
                <Text style={styles.statLabel}>Max Reps</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCardWide}>
                <Text style={styles.statValueSmall}>
                  {fmt(stats.avgWeight)}kg
                </Text>
                <Text style={styles.statLabel}>Avg Weight</Text>
              </View>
              <View style={styles.statCardWide}>
                <Text style={styles.statValueSmall}>{fmt(stats.avgReps)}</Text>
                <Text style={styles.statLabel}>Avg Reps</Text>
              </View>
              <View style={styles.statCardWide}>
                <Text style={styles.statValueSmall}>
                  {fmt(stats.totalVolume)}kg
                </Text>
                <Text style={styles.statLabel}>Total Volume</Text>
              </View>
            </View>

            {stats.lastWorkout && (
              <View style={styles.lastWorkoutCard}>
                <Text style={styles.lastWorkoutLabel}>Last Workout</Text>
                <Text style={styles.lastWorkoutDate}>
                  {stats.lastWorkout.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📅 Workout History</Text>
              <UniversalCalendar
                hasDataOnDate={hasSetsOnDate}
                onDatePress={handleDatePress}
                initialView='week'
                legendText={`Workout day for ${selectedExercise}`}
                dotColor={colors.success}
              />
            </View>

            <ProgressChart
              title='Weight Progress (kg)'
              icon='💪'
              data={getChartData("weight")}
              yAxisSuffix='kg'
              chartWidth={containerWidth || screenWidth - 40}
            />
            <ProgressChart
              title='Volume Progress (kg)'
              icon='📦'
              data={getChartData("volume")}
              yAxisSuffix='kg'
              chartWidth={containerWidth || screenWidth - 40}
            />
            <ProgressChart
              title='Reps Progress'
              icon='🔢'
              data={getChartData("reps")}
              chartWidth={containerWidth || screenWidth - 40}
            />
          </>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataIcon}>📭</Text>
            <Text style={styles.noDataTitle}>No Data Yet</Text>
            <Text style={styles.noDataText}>
              No completed sets for "{selectedExercise}"
            </Text>
          </View>
        )}
      </View>

      {/* Exercise Dropdown Modal */}
      <ModalSheet
        visible={showDropdown}
        onClose={() => {
          setShowDropdown(false)
          setSearchQuery("")
        }}
        title='Select Exercise'
        showCancelButton={false}
        showConfirmButton={false}
        scrollable
      >
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder='Search exercises...'
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize='none'
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearSearchButton}
              onPress={() => setSearchQuery("")}
            >
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowZeroSetExercises(!showZeroSetExercises)}
          >
            <Text style={styles.filterButtonText}>
              {showZeroSetExercises ? "Hide" : "Show"} exercises with 0 sets
            </Text>
            <Text style={styles.filterButtonIcon}>
              {showZeroSetExercises ? "👁️" : "👁️‍🗨️"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.filterHint}>
            {availableExercises.filter((e) => e.totalSets === 0).length}{" "}
            exercises hidden
          </Text>
        </View>

        {filteredExercises.map((exercise) => (
          <TouchableOpacity
            key={exercise.name}
            style={[
              styles.dropdownItem,
              selectedExercise === exercise.name && styles.dropdownItemSelected,
            ]}
            onPress={() => {
              setSelectedExercise(exercise.name)
              setShowDropdown(false)
              setSearchQuery("")
            }}
          >
            <View style={styles.dropdownItemContent}>
              <Text
                style={[
                  styles.dropdownItemText,
                  selectedExercise === exercise.name &&
                    styles.dropdownItemTextSelected,
                ]}
              >
                {exercise.name}
              </Text>
              <View style={styles.dropdownItemMeta}>
                {exercise.muscleGroup && (
                  <Text style={styles.dropdownItemMuscle}>
                    {exercise.muscleGroup}
                  </Text>
                )}
                <Text style={styles.dropdownItemSets}>
                  {exercise.totalSets} sets
                </Text>
              </View>
            </View>
            {selectedExercise === exercise.name && (
              <Text style={styles.dropdownItemCheck}>✓</Text>
            )}
          </TouchableOpacity>
        ))}

        {filteredExercises.length === 0 && (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>
              {searchQuery.length > 0
                ? `No exercises match "${searchQuery}"`
                : "No exercises with data"}
            </Text>
          </View>
        )}
      </ModalSheet>

      {/* Date Sets Modal */}
      <ModalSheet
        visible={showDateSets}
        onClose={() => setShowDateSets(false)}
        title={selectedDate ? formatDate(selectedDate) : ""}
        showCancelButton={false}
        showConfirmButton={false}
        scrollable
      >
        {selectedDate &&
          getSetsForDate(selectedDate).map((set, index) => (
            <View key={index} style={styles.setCard}>
              <View style={styles.setCardHeader}>
                <Text style={styles.setCardTitle}>Set {set.setNumber}</Text>
                <Text style={styles.setCardTime}>{formatTime(set.date)}</Text>
              </View>
              <View style={styles.setCardStats}>
                <View style={styles.setCardStat}>
                  <Text style={styles.setCardStatValue}>
                    {fmt(set.weight)}kg
                  </Text>
                  <Text style={styles.setCardStatLabel}>Weight</Text>
                </View>
                <View style={styles.setCardStat}>
                  <Text style={styles.setCardStatValue}>{set.reps}</Text>
                  <Text style={styles.setCardStatLabel}>Reps</Text>
                </View>
                <View style={styles.setCardStat}>
                  <Text style={styles.setCardStatValue}>
                    {fmt(set.weight * set.reps)}kg
                  </Text>
                  <Text style={styles.setCardStatLabel}>Volume</Text>
                </View>
              </View>
              <Text style={styles.setCardDay}>Day {set.dayNumber}</Text>
            </View>
          ))}
      </ModalSheet>
    </ScrollView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    header: { marginBottom: 25, alignItems: "center" },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
    },
    demoBanner: {
      backgroundColor: "#fff3cd",
      borderRadius: 12,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "#ffc107",
    },
    demoBannerIcon: { fontSize: 20, marginRight: 10 },
    demoBannerText: {
      flex: 1,
      fontSize: 14,
      color: "#856404",
      fontWeight: "500",
    },
    warningBanner: {
      backgroundColor: "#fff3cd",
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "#ffc107",
    },
    warningIcon: { fontSize: 24, marginRight: 12 },
    warningTextContainer: { flex: 1 },
    warningTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#856404",
      marginBottom: 4,
    },
    warningText: { fontSize: 14, color: "#856404", lineHeight: 20 },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    dropdownButton: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.accent,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    dropdownButtonContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
    },
    dropdownButtonLeft: { flex: 1 },
    dropdownButtonText: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    dropdownButtonSubtext: { fontSize: 14, color: colors.accent },
    dropdownArrow: { fontSize: 16, color: colors.accent, marginLeft: 12 },
    searchContainer: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      position: "relative",
    },
    searchInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      paddingRight: 40,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    clearSearchButton: {
      position: "absolute",
      right: 24,
      top: 14,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "#ddd",
      alignItems: "center",
      justifyContent: "center",
    },
    clearSearchText: { fontSize: 14, color: colors.textSecondary },
    filterContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      backgroundColor: colors.inputBackground,
    },
    filterButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    filterButtonText: { fontSize: 14, fontWeight: "500", color: colors.accent },
    filterButtonIcon: { fontSize: 16 },
    filterHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 6,
      textAlign: "center",
    },
    dropdownItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    dropdownItemSelected: { backgroundColor: colors.accentLight },
    dropdownItemContent: { flex: 1 },
    dropdownItemText: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    dropdownItemTextSelected: { color: colors.accent, fontWeight: "600" },
    dropdownItemMeta: { flexDirection: "row", alignItems: "center", gap: 12 },
    dropdownItemMuscle: { fontSize: 13, color: colors.textSecondary },
    dropdownItemSets: {
      fontSize: 13,
      color: colors.success,
      fontWeight: "600",
    },
    dropdownItemCheck: { fontSize: 20, color: colors.accent, marginLeft: 12 },
    noResultsContainer: { padding: 40, alignItems: "center" },
    noResultsText: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "center",
    },
    setCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    setCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    setCardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    setCardTime: { fontSize: 14, color: colors.textSecondary },
    setCardStats: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: 8,
    },
    setCardStat: { alignItems: "center" },
    setCardStatValue: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.accent,
      marginBottom: 4,
    },
    setCardStatLabel: { fontSize: 12, color: colors.textSecondary },
    setCardDay: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 8,
    },
    loadingContainer: { padding: 40, alignItems: "center" },
    loadingText: { marginTop: 12, fontSize: 16, color: colors.textSecondary },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 10,
    },
    statCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      flex: 1,
      minWidth: "47%",
      alignItems: "center",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    statValue: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.accent,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
    },
    statsRow: { flexDirection: "row", gap: 10, marginBottom: 15 },
    statCardWide: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    statValueSmall: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.accent,
      marginBottom: 4,
    },
    lastWorkoutCard: {
      backgroundColor: colors.accentLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
    },
    lastWorkoutLabel: {
      fontSize: 13,
      color: colors.accent,
      fontWeight: "600",
      marginBottom: 4,
    },
    lastWorkoutDate: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    emptyIcon: { fontSize: 64, marginBottom: 20 },
    emptyTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 10,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 24,
    },
    noDataContainer: {
      padding: 40,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginTop: 20,
    },
    noDataIcon: { fontSize: 48, marginBottom: 16 },
    noDataTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    noDataText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
  })
