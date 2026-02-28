/**
 * LiveSessionTab.tsx
 *
 * Read-only WorkoutScreen-style view of a friend's currently active session.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from "react-native"
import { sharingApi } from "../services/api"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Friend {
  id: string
  username: string
}

interface SetTiming {
  exercise_name?: string
  exercise_muscle_group?: string
  exercise_index?: number
  set_index: number
  weight?: number
  reps?: number
  end_time?: string
  isWarmup?: boolean
}

interface LiveData {
  start_time?: string
  day_number?: number
  day_title?: string
  set_timings?: SetTiming[]
  muscle_groups?: unknown[]
}

interface Exercise {
  name?: string
  muscleGroup?: string
  muscle_group?: string
  sets?: number
  setsByPerson?: Record<string, number | string>
}

interface ProgramDay {
  dayNumber: number
  exercises?: Exercise[]
  people?: Record<string, { exercises?: Exercise[] }>
}

interface ReceivedProgram {
  senderId: string
  programData?: {
    days?: ProgramDay[]
  }
}

type Phase = "idle" | "checking" | "watching" | "no_session" | "ended" | "error"

interface LiveSessionTabProps {
  friend: Friend
  isVisible: boolean
  receivedPrograms?: ReceivedProgram[]
  socketLastMessage?: {
    type: string
    liveSession?: LiveData
    friendId?: string
  } | null
}

interface ExerciseEntry {
  exerciseName: string
  muscleGroup: string | null
  totalSets: number
  completedSetMap: Record<number, SetTiming>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(sec: number): string {
  if (!sec && sec !== 0) return "0s"
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatStartTime(raw?: string): string {
  if (!raw) return ""
  const d = new Date(raw.replace(" ", "T"))
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function elapsedFromStart(raw?: string): number {
  if (!raw) return 0
  const start = new Date(raw.replace(" ", "T")).getTime()
  return Math.floor((Date.now() - start) / 1000)
}

// ─── Live Dot ─────────────────────────────────────────────────────────────────

function LiveDot() {
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.15,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])
  return <Animated.View style={[liveDotSt.dot, { opacity }]} />
}

const liveDotSt = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginRight: 6,
  },
})

// ─── Set Bubble ───────────────────────────────────────────────────────────────

interface SetBubbleProps {
  setIndex: number
  setData: SetTiming | null
}

function SetBubble({ setIndex, setData }: SetBubbleProps) {
  const done = !!setData
  const isWarmup = done && (setData?.isWarmup ?? false)

  return (
    <View
      style={[bbl.bubble, done && bbl.bubbleDone, isWarmup && bbl.bubbleWarmup]}
    >
      <Text style={[bbl.num, done && bbl.numDone]}>
        {isWarmup ? "W" : setIndex + 1}
      </Text>
      {done && (
        <View style={bbl.details}>
          <Text style={bbl.detailText}>{setData?.weight ?? 0}kg</Text>
          <Text style={bbl.detailText}>×{setData?.reps ?? 0}</Text>
        </View>
      )}
      {done && (
        <View style={bbl.check}>
          <Text style={bbl.checkText}>✓</Text>
        </View>
      )}
    </View>
  )
}

const bbl = StyleSheet.create({
  bubble: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    borderWidth: 2,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    padding: 4,
  },
  bubbleDone: { backgroundColor: "#667eea", borderColor: "#667eea" },
  bubbleWarmup: { backgroundColor: "#fb923c", borderColor: "#ea580c" },
  num: { fontSize: 18, fontWeight: "bold", color: "#999", marginBottom: 2 },
  numDone: { color: "#fff" },
  details: { alignItems: "center" },
  detailText: { fontSize: 10, color: "#fff", fontWeight: "500" },
  check: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
})

// ─── Exercise Card ────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  exerciseName: string
  muscleGroup: string | null
  totalSets: number
  completedSetMap: Record<number, SetTiming>
}

function ExerciseCard({
  exerciseName,
  muscleGroup,
  totalSets,
  completedSetMap,
}: ExerciseCardProps) {
  const completedCount = Object.keys(completedSetMap).length
  const allDone = totalSets > 0 && completedCount >= totalSets

  return (
    <View style={[exSt.card, allDone && exSt.cardDone]}>
      <View style={exSt.header}>
        <View style={exSt.info}>
          <Text style={[exSt.name, allDone && exSt.nameDone]}>
            {exerciseName}
          </Text>
          {muscleGroup ? <Text style={exSt.muscle}>{muscleGroup}</Text> : null}
        </View>
        <View style={exSt.badge}>
          <Text style={exSt.badgeText}>
            {completedCount}/{totalSets}
          </Text>
        </View>
      </View>
      <View style={exSt.sets}>
        {Array.from({ length: totalSets }, (_, i) => (
          <SetBubble
            key={i}
            setIndex={i}
            setData={completedSetMap[i] ?? null}
          />
        ))}
      </View>
    </View>
  )
}

const exSt = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardDone: { backgroundColor: "#f0fff4", borderColor: "#10b981" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 17, fontWeight: "600", color: "#333", marginBottom: 3 },
  nameDone: { color: "#10b981" },
  muscle: { fontSize: 13, color: "#888" },
  badge: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: { fontSize: 13, fontWeight: "600", color: "#667eea" },
  sets: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
})

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LiveSessionTab({
  friend,
  isVisible,
  receivedPrograms = [],
  socketLastMessage,
}: LiveSessionTabProps) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLive = useCallback(async (fid: string, sid: string) => {
    try {
      const live = (await sharingApi.getFriendLiveSession(
        fid,
        sid,
      )) as LiveData | null
      if (!live) {
        setPhase("ended")
        return
      }
      setLiveData(live)
      setElapsedSec(elapsedFromStart(live.start_time))
    } catch {
      // keep last data
    }
  }, [])

  const startWatching = useCallback(async () => {
    if (!friend?.id) return
    setPhase("checking")
    setLiveData(null)
    setSessionId(null)
    try {
      const active = (await sharingApi.getFriendActiveSession(friend.id)) as {
        sessionId?: string
      } | null
      if (!active?.sessionId) {
        setPhase("no_session")
        return
      }

      const sid = active.sessionId
      setSessionId(sid)

      const live = (await sharingApi.getFriendLiveSession(
        friend.id,
        sid,
      )) as LiveData | null
      if (!live) {
        setPhase("no_session")
        return
      }

      setLiveData(live)
      setElapsedSec(elapsedFromStart(live.start_time))
      setPhase("watching")
    } catch {
      setPhase("error")
    }
  }, [friend?.id, fetchLive])

  // Elapsed ticker
  useEffect(() => {
    if (phase !== "watching") {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
      return
    }
    tickRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [phase])

  useEffect(() => {
    if (isVisible) void startWatching()
  }, [isVisible, friend?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socketLastMessage || phase !== "watching") return

    if (
      socketLastMessage.type === "live_session_update" &&
      socketLastMessage.liveSession
    ) {
      setLiveData(socketLastMessage.liveSession)
      if (socketLastMessage.liveSession.start_time) {
        setElapsedSec(
          elapsedFromStart(socketLastMessage.liveSession.start_time),
        )
      }
    }

    if (
      socketLastMessage.type === "friend_session_ended" &&
      socketLastMessage.friendId === friend?.id
    ) {
      setPhase("ended")
    }
  }, [socketLastMessage, phase, friend?.id])

  const onRefresh = async () => {
    setRefreshing(true)
    await startWatching()
    setRefreshing(false)
  }

  // Build planned exercise scaffold from shared program
  const programPlan = useMemo((): Map<
    string,
    { name: string; muscleGroup: string | null; totalSets: number }
  > | null => {
    if (!liveData?.day_number) return null

    const prog = receivedPrograms.find((p) => p.senderId === friend?.id)
    if (!prog?.programData?.days) return null

    const day = prog.programData.days.find(
      (d) => d.dayNumber === liveData.day_number,
    )
    if (!day) return null

    const plan = new Map<
      string,
      { name: string; muscleGroup: string | null; totalSets: number }
    >()

    const exercises: Exercise[] = Array.isArray(day.exercises)
      ? day.exercises
      : day.people
        ? Object.values(day.people).flatMap((pw) => pw?.exercises ?? [])
        : []

    exercises.forEach((e) => {
      const key = (e.name ?? "").trim().toLowerCase()
      if (!key) return

      let totalSets = 0
      if (e.setsByPerson && typeof e.setsByPerson === "object") {
        totalSets = Math.max(
          ...Object.values(e.setsByPerson).map(Number).filter(isFinite),
          0,
        )
      } else if (typeof e.sets === "number") {
        totalSets = e.sets
      }

      if (!plan.has(key) || (plan.get(key)?.totalSets ?? 0) < totalSets) {
        plan.set(key, {
          name: e.name ?? key,
          muscleGroup: e.muscleGroup ?? e.muscle_group ?? null,
          totalSets,
        })
      }
    })

    return plan.size > 0 ? plan : null
  }, [liveData?.day_number, receivedPrograms, friend?.id])

  const exerciseList = useMemo((): ExerciseEntry[] => {
    const completedByExercise = new Map<string, Record<number, SetTiming>>()
    ;(liveData?.set_timings ?? []).forEach((t) => {
      const key = (t.exercise_name ?? "").trim().toLowerCase()
      if (!completedByExercise.has(key)) completedByExercise.set(key, {})
      completedByExercise.get(key)![t.set_index] = t
    })

    if (programPlan) {
      const list: ExerciseEntry[] = []
      const coveredKeys = new Set<string>()

      programPlan.forEach((info, key) => {
        coveredKeys.add(key)
        const completedSetMap = completedByExercise.get(key) ?? {}
        const maxLoggedIndex = Object.keys(completedSetMap).reduce(
          (max, i) => Math.max(max, parseInt(i)),
          -1,
        )
        const totalSets = Math.max(info.totalSets, maxLoggedIndex + 1)
        list.push({
          exerciseName: info.name,
          muscleGroup: info.muscleGroup,
          totalSets,
          completedSetMap,
        })
      })

      completedByExercise.forEach((completedSetMap, key) => {
        if (coveredKeys.has(key)) return
        const sample = liveData?.set_timings?.find(
          (t) => (t.exercise_name ?? "").trim().toLowerCase() === key,
        )
        const maxIndex = Math.max(...Object.keys(completedSetMap).map(Number))
        list.push({
          exerciseName: sample?.exercise_name ?? key,
          muscleGroup: sample?.exercise_muscle_group ?? null,
          totalSets: maxIndex + 1,
          completedSetMap,
        })
      })
      return list
    }

    return Array.from(completedByExercise.entries()).map(
      ([key, completedSetMap]) => {
        const sample = liveData?.set_timings?.find(
          (t) => (t.exercise_name ?? "").trim().toLowerCase() === key,
        )
        const maxIndex = Math.max(...Object.keys(completedSetMap).map(Number))
        return {
          exerciseName: sample?.exercise_name ?? key,
          muscleGroup: sample?.exercise_muscle_group ?? null,
          totalSets: maxIndex + 1,
          completedSetMap,
        }
      },
    )
  }, [liveData, programPlan])

  const totalCompleted = liveData?.set_timings?.length ?? 0
  const totalPlanned = exerciseList.reduce((n, e) => n + e.totalSets, 0)
  const progressPct =
    totalPlanned > 0 ? Math.min((totalCompleted / totalPlanned) * 100, 100) : 0

  const sessionTitle = liveData
    ? liveData.day_title
      ? liveData.day_title.includes("—")
        ? (liveData.day_title.split("—")[1]?.trim() ?? "")
        : liveData.day_title
      : `Day ${liveData.day_number ?? "?"}`
    : ""

  // Empty states
  if (phase === "idle" || phase === "checking") {
    return (
      <View style={st.center}>
        <ActivityIndicator size='large' color='#667eea' />
        <Text style={st.centerSub}>Loading live session…</Text>
      </View>
    )
  }

  if (phase === "no_session") {
    return (
      <View style={st.center}>
        <Text style={st.centerIcon}>🏋️</Text>
        <Text style={st.centerTitle}>
          {friend?.username} isn't working out right now
        </Text>
        <Text style={st.centerSub}>
          Come back when they start a session, or pull down to check again.
        </Text>
        <TouchableOpacity style={st.btn} onPress={() => void startWatching()}>
          <Text style={st.btnText}>Check Again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase === "ended") {
    return (
      <View style={st.center}>
        <Text style={st.centerIcon}>✅</Text>
        <Text style={st.centerTitle}>Session Ended</Text>
        <Text style={st.centerSub}>
          {friend?.username} finished their workout.
        </Text>
        <TouchableOpacity style={st.btn} onPress={() => void startWatching()}>
          <Text style={st.btnText}>Check for New Session</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase === "error") {
    return (
      <View style={st.center}>
        <Text style={st.centerIcon}>⚠️</Text>
        <Text style={st.centerTitle}>Couldn't Load Session</Text>
        <Text style={st.centerSub}>Check your connection and try again.</Text>
        <TouchableOpacity style={st.btn} onPress={() => void startWatching()}>
          <Text style={st.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      style={st.scroll}
      contentContainerStyle={st.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          colors={["#667eea"]}
          tintColor='#667eea'
        />
      }
    >
      {/* Header card */}
      <View style={st.headerCard}>
        <View style={st.liveBadge}>
          <LiveDot />
          <Text style={st.liveBadgeText}>LIVE</Text>
          <Text style={st.liveUsername}> · {friend?.username}</Text>
        </View>

        <View style={st.headerTop}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={st.dayNumber}>Day {liveData?.day_number ?? "?"}</Text>
            {sessionTitle ? (
              <Text style={st.dayTitle} numberOfLines={2}>
                {sessionTitle}
              </Text>
            ) : null}
          </View>
          <View style={st.setsInfo}>
            <Text style={st.setsLabel}>Sets Done</Text>
            <Text style={st.setsValue}>{totalCompleted}</Text>
          </View>
        </View>

        <View style={st.progressContainer}>
          <View style={st.progressBar}>
            <View
              style={[
                st.progressFill,
                { width: `${progressPct}%` as `${number}%` },
              ]}
            />
          </View>
          <View style={st.progressTextRow}>
            <Text style={st.progressText}>
              {totalCompleted}
              {totalPlanned > 0 ? ` / ${totalPlanned}` : ""} sets
            </Text>
            <Text style={st.progressText}>⏱ {formatElapsed(elapsedSec)}</Text>
          </View>
        </View>

        {liveData?.start_time ? (
          <Text style={st.startedAt}>
            Started at {formatStartTime(liveData.start_time)}
          </Text>
        ) : null}

        <View style={st.statsRow}>
          <View style={st.stat}>
            <Text style={st.statLabel}>⏱️ Duration</Text>
            <Text style={st.statValue}>{formatElapsed(elapsedSec)}</Text>
          </View>
          <View style={st.stat}>
            <Text style={st.statLabel}>💪 Exercises</Text>
            <Text style={st.statValue}>{exerciseList.length}</Text>
          </View>
          <View style={st.stat}>
            <Text style={st.statLabel}>📦 Sets Done</Text>
            <Text style={st.statValue}>{totalCompleted}</Text>
          </View>
        </View>

        {Array.isArray(liveData?.muscle_groups) &&
          liveData.muscle_groups.length > 0 && (
            <View style={st.muscleRow}>
              {liveData.muscle_groups.map((g, i) => (
                <View key={i} style={st.muscleTag}>
                  <Text style={st.muscleTagText}>{String(g)}</Text>
                </View>
              ))}
            </View>
          )}

        {!programPlan && (
          <View style={st.noPlanNotice}>
            <Text style={st.noPlanText}>
              💡 Ask {friend?.username} to share their program to see all
              planned sets
            </Text>
          </View>
        )}
      </View>

      {/* Exercise cards */}
      {exerciseList.length === 0 ? (
        <View style={st.noExercises}>
          <Text style={st.noExercisesIcon}>🔄</Text>
          <Text style={st.noExercisesText}>
            No sets logged yet — pull down to refresh
          </Text>
        </View>
      ) : (
        exerciseList.map((e, i) => (
          <ExerciseCard
            key={i}
            exerciseName={e.exerciseName}
            muscleGroup={e.muscleGroup}
            totalSets={e.totalSets}
            completedSetMap={e.completedSetMap}
          />
        ))
      )}

      <Text style={st.refreshHint}>
        Auto-refreshes every 8s · Pull down to refresh now
      </Text>
    </ScrollView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#f5f5f5",
    minHeight: 400,
  },
  centerIcon: { fontSize: 56, marginBottom: 16 },
  centerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  centerSub: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
    marginTop: 6,
  },
  btn: {
    backgroundColor: "#667eea",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  scroll: { flex: 1, backgroundColor: "#f5f5f5" },
  scrollContent: { padding: 16, paddingBottom: 48 },
  headerCard: {
    backgroundColor: "#667eea",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  liveBadge: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  liveBadgeText: {
    color: "#10b981",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.2,
  },
  liveUsername: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  dayNumber: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  dayTitle: { fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 20 },
  setsInfo: { alignItems: "flex-end" },
  setsLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 2 },
  setsValue: { fontSize: 36, fontWeight: "bold", color: "#fff" },
  progressContainer: { marginBottom: 10 },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 4 },
  progressTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: { fontSize: 13, color: "rgba(255,255,255,0.9)" },
  startedAt: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 14 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 14,
  },
  stat: { alignItems: "center" },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  muscleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  muscleTag: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  muscleTagText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  noPlanNotice: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: 10,
  },
  noPlanText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 18,
  },
  noExercises: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    marginBottom: 16,
  },
  noExercisesIcon: { fontSize: 36, marginBottom: 12 },
  noExercisesText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    fontStyle: "italic",
  },
  refreshHint: {
    fontSize: 12,
    color: "#bbb",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
})
