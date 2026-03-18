/**
 * FriendsScreen
 *
 * All sharing is now permission-based. Five permission types:
 *   history, analytics, program, joint_session, watch_session
 *
 * Analytics and program sharing are granted via PermissionRow toggles in the
 * Actions tab, exactly like the other three.  The old "Share My Analytics" /
 * "Share My Program" action rows and their separate API calls are removed.
 *
 * Program data is stored in the permission payload so there is no separate
 * program_shares table.  When the user grants the 'program' permission, the
 * current workoutData is packaged into the payload at that moment.
 *
 * A new "Live" tab shows the friend's current workout session in real-time,
 * styled like WorkoutScreen. Requires the friend to have granted watch_session.
 */

import React, { useState, useEffect, useCallback } from "react"
import type { WebSocketMessage } from "../context/hooks/useRealtimeSocket"
import type { Friend } from "../services/api"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuth } from "../context/AuthContext"
import { friendsApi, sharingApi } from "../services/api"
import type { GrantedPermission, ReceivedPermission } from "../services/api"
import { useWorkout } from "../context/WorkoutContext"
import ModalSheet from "../components/ModalSheet"
import UniversalCalendar from "../components/UniversalCalendar"
import ExerciseAnalytics from "../components/ExerciseAnalytics"
import LiveSessionTab from "../components/LiveSessionTab"
import { useAlert } from "../components/CustomAlert"
import type { PendingFriendRequest, SentFriendRequest } from "../services/api"
import { useTheme } from "../context/ThemeContext"

// ─────────────────────────────────────────────────────────────────────────────
// Local interfaces
// ─────────────────────────────────────────────────────────────────────────────

interface FriendSessionStatus {
  id: number | string
  active: boolean
}

interface ReceivedProgram {
  id: number | string
  senderId: number | string
  senderUsername: string
  sharedAt: string
  message: string | null
  programData: ProgramData
}

interface ProgramData {
  name?: string
  totalDays?: number
  people?: string[]
  days?: ProgramDay[]
}

interface ProgramDay {
  dayNumber?: number
  dayTitle?: string
  exercises?: ProgramExercise[]
}

interface ProgramExercise {
  name?: string
  muscleGroup?: string
  setsByPerson?: Record<string, number>
}

interface SessionRecord {
  id: number | string
  day_number?: number
  day_title?: string
  start_time?: string | number
  total_duration?: number
  completed_sets?: number
  muscle_groups?: unknown[]
  set_timings?: SetTiming[]
  groupedExercises?: GroupedExercise[]
}

interface SetTiming {
  exercise_name?: string
  exercise_id?: number | string
  set_index: number
  weight?: number | string
  reps?: number | string
}

interface GroupedExercise {
  exerciseName: string
  sets: SetTiming[]
}

interface UserSearchResult {
  id: number | string
  username: string
  email?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Friend active-session status polling
// ─────────────────────────────────────────────────────────────────────────────
const useFriendSessionStatuses = (
  friends: Friend[],
  socketLastMessage: WebSocketMessage | null,
  loadFriendsFn?: () => void,
): Record<string | number, boolean> => {
  const [statuses, setStatuses] = useState<Record<string | number, boolean>>({})

  const refresh = useCallback(async () => {
    if (!friends.length) {
      setStatuses({})
      return
    }
    const results = await Promise.allSettled(
      friends.map((f) =>
        sharingApi
          .getFriendSessionStatus(f.id)
          .then((r) => ({
            id: f.id,
            active: !!(r as { hasActiveSession?: boolean })?.hasActiveSession,
          }))
          .catch(() => ({ id: f.id, active: false })),
      ),
    )
    const map: Record<string | number, boolean> = {}
    results.forEach((r) => {
      if (r.status === "fulfilled") map[r.value.id] = r.value.active
    })
    setStatuses(map)
  }, [friends])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!socketLastMessage) return
    if (socketLastMessage.type === "friend_request_received") {
      loadFriendsFn?.()
    }
  }, [socketLastMessage, loadFriendsFn])

  useEffect(() => {
    if (!socketLastMessage) return
    if (socketLastMessage.type === "friend_session_started") {
      setStatuses((prev) => ({
        ...prev,
        [(socketLastMessage as unknown as { friendId: number | string })
          .friendId]: true,
      }))
    }
    if (socketLastMessage.type === "friend_session_ended") {
      setStatuses((prev) => ({
        ...prev,
        [(socketLastMessage as unknown as { friendId: number | string })
          .friendId]: false,
      }))
    }
  }, [socketLastMessage])

  return statuses
}

// ─────────────────────────────────────────────────────────────────────────────
// Incoming invite banner
// ─────────────────────────────────────────────────────────────────────────────
interface InviteBannerProps {
  invite: { fromUsername: string } | null
  onAccept: () => void
  onDecline: () => void
}

function InviteBanner({
  invite,
  onAccept,
  onDecline,
}: InviteBannerProps): React.JSX.Element | null {
  const { colors } = useTheme()
  const bannerStyles = makeBannerStyles(colors)
  if (!invite) return null
  return (
    <View style={bannerStyles.container}>
      <View style={bannerStyles.left}>
        <Text style={bannerStyles.icon}>🏋️</Text>
        <View>
          <Text style={bannerStyles.title}>Joint Session Invite</Text>
          <Text style={bannerStyles.sub}>
            <Text style={bannerStyles.username}>{invite.fromUsername}</Text>
            {" wants to lift together!"}
          </Text>
        </View>
      </View>
      <View style={bannerStyles.actions}>
        <TouchableOpacity style={bannerStyles.decline} onPress={onDecline}>
          <Text style={bannerStyles.declineText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={bannerStyles.accept} onPress={onAccept}>
          <Text style={bannerStyles.acceptText}>Join</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const makeBannerStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    left: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
    icon: { fontSize: 28 },
    title: {
      color: colors.surface,
      fontWeight: "700",
      fontSize: 14,
      marginBottom: 2,
    },
    sub: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
    username: { color: colors.info, fontWeight: "600" },
    actions: { flexDirection: "row", gap: 8, alignItems: "center" },
    decline: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(255,255,255,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    declineText: { color: colors.surface, fontSize: 14, fontWeight: "bold" },
    accept: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.accentDark,
    },
    acceptText: { color: colors.surface, fontSize: 14, fontWeight: "700" },
  })

// ─────────────────────────────────────────────────────────────────────────────
// Lift Together button
// ─────────────────────────────────────────────────────────────────────────────
interface LiftTogetherButtonProps {
  onPress: () => void
  status?: string
  small?: boolean
}

function LiftTogetherButton({
  onPress,
  status,
  small = false,
}: LiftTogetherButtonProps): React.JSX.Element {
  const { colors } = useTheme()
  const liftStyles = makeLiftStyles(colors)
  const label =
    status === "sending"
      ? "Sending…"
      : status === "waiting"
        ? "Waiting…"
        : status === "active"
          ? "✓ In Session"
          : status === "declined"
            ? "Declined"
            : "🏋️ Lift Together"
  const bg =
    status === "active"
      ? colors.success
      : status === "waiting"
        ? colors.warning
        : status === "declined"
          ? colors.textSecondary
          : colors.accentDark
  const busy = status === "sending" || status === "waiting"
  return (
    <TouchableOpacity
      style={[
        liftStyles.button,
        small && liftStyles.buttonSmall,
        { backgroundColor: bg },
        busy && { opacity: 0.75 },
      ]}
      onPress={onPress}
      disabled={busy || status === "active"}
      activeOpacity={0.8}
    >
      {busy ? (
        <ActivityIndicator
          size='small'
          color='#fff'
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text style={[liftStyles.label, small && liftStyles.labelSmall]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const makeLiftStyles = (colors: any) =>
  StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
    },
    buttonSmall: { paddingHorizontal: 10, paddingVertical: 6 },
    label: { color: colors.surface, fontWeight: "700", fontSize: 14 },
    labelSmall: { fontSize: 12 },
  })

// ─────────────────────────────────────────────────────────────────────────────
// Permission toggle row
// ─────────────────────────────────────────────────────────────────────────────
interface PermissionRowProps {
  icon: string
  title: string
  description: string
  granted: boolean
  loading: boolean
  onGrant: () => void
  onRevoke: () => void
}

function PermissionRow({
  icon,
  title,
  description,
  granted,
  loading,
  onGrant,
  onRevoke,
}: PermissionRowProps): React.JSX.Element {
  const { colors } = useTheme()
  const permStyles = makePermStyles(colors)
  return (
    <View style={[permStyles.row, granted && permStyles.rowGranted]}>
      <Text style={permStyles.icon}>{icon}</Text>
      <View style={permStyles.text}>
        <Text style={permStyles.title}>{title}</Text>
        <Text style={permStyles.desc}>{description}</Text>
      </View>
      {loading ? (
        <ActivityIndicator
          size='small'
          color='#667eea'
          style={{ marginLeft: 8 }}
        />
      ) : granted ? (
        <TouchableOpacity style={permStyles.revokeBtn} onPress={onRevoke}>
          <Text style={permStyles.revokeBtnText}>Revoke</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={permStyles.grantBtn} onPress={onGrant}>
          <Text style={permStyles.grantBtnText}>Grant</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const makePermStyles = (colors: any) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    rowGranted: {
      borderColor: colors.success,
      backgroundColor: colors.successLight,
    },
    icon: { fontSize: 24, marginRight: 12 },
    text: { flex: 1 },
    title: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    desc: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
    grantBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 10,
      marginLeft: 8,
    },
    grantBtnText: { color: colors.surface, fontSize: 13, fontWeight: "700" },
    revokeBtn: {
      backgroundColor: colors.errorLight,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      marginLeft: 8,
    },
    revokeBtnText: { color: colors.error, fontSize: 13, fontWeight: "600" },
  })

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function FriendsScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const liftStyles = makeLiftStyles(colors)
  const permStyles = makePermStyles(colors)
  const watchStyles = makeWatchStyles(colors)
  const jointStyles = makeJointStyles(colors)
  const { user } = useAuth()
  const {
    workoutData,
    workoutStartTime,
    currentSessionId,
    isInJointSession,
    jointSession,
    pendingJointInvite,
    jointInviteStatus,
    sendJointInvite,
    acceptJointInvite,
    declineJointInvite,
    leaveJointSession,
    isWatching,
    watchTarget,
    watchLoading,
    startWatching,
    stopWatching,
    socketLastMessage,
  } = useWorkout()

  const { alert, AlertComponent } = useAlert()

  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("friends")

  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<
    PendingFriendRequest[]
  >([])
  const [sentRequests, setSentRequests] = useState<SentFriendRequest[]>([])

  const [searchQuery, setSearchQuery] = useState<string>("")
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState<boolean>(false)

  const [sharingStats, setSharingStats] = useState<Record<
    string,
    unknown
  > | null>(null)

  // ── Permissions ───────────────────────────────────────────────────────────
  const [grantedPermissions, setGrantedPermissions] = useState<
    GrantedPermission[]
  >([])
  const [receivedPermissions, setReceivedPermissions] = useState<
    ReceivedPermission[]
  >([])
  const [permissionLoading, setPermissionLoading] = useState<
    Record<string, boolean>
  >({})

  const [showFriendDetailModal, setShowFriendDetailModal] =
    useState<boolean>(false)
  const [activeFriendTab, setActiveFriendTab] = useState<string>("history")
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)

  const [friendSessionHistory, setFriendSessionHistory] = useState<
    SessionRecord[]
  >([])
  const [loadingFriendSessions, setLoadingFriendSessions] =
    useState<boolean>(false)
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(
    null,
  )
  const [showSessionDetails, setShowSessionDetails] = useState<boolean>(false)
  const [friendSessionsWithTimings, setFriendSessionsWithTimings] = useState<
    SessionRecord[]
  >([])
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  // selectedProgram holds a person name string (or null for "All")
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)

  const [checkingActiveSession, setCheckingActiveSession] =
    useState<boolean>(false)

  const hasOwnActiveSession = !!workoutStartTime && !!currentSessionId

  // ── Data loading ──────────────────────────────────────────────────────────
  // Declare loadFriends first so it can be referenced in useFriendSessionStatuses
  const loadFriends = useCallback(async () => {
    const [friendsData, pendingData, sentData] = await Promise.all([
      friendsApi.getFriends(),
      friendsApi.getPendingRequests(),
      friendsApi.getSentRequests(),
    ])
    setFriends(friendsData || [])
    setPendingRequests(pendingData || [])
    setSentRequests(sentData || [])
  }, [])

  const friendSessionStatuses = useFriendSessionStatuses(
    friends,
    socketLastMessage,
    loadFriends,
  )
  const [inviteTargetId, setInviteTargetId] = useState<number | string | null>(
    null,
  )

  // ── Permission helpers ────────────────────────────────────────────────────

  const getGrantedPermission = (
    friendId: number | string,
    type: string,
  ): GrantedPermission | undefined =>
    grantedPermissions.find(
      (p) => p.toUserId === friendId && p.permissionType === type,
    )

  const hasReceivedPermission = (
    friendId: number | string | undefined,
    type: string,
  ): boolean => {
    if (friendId === undefined) return false
    return receivedPermissions.some(
      (p) => p.fromUserId === friendId && p.permissionType === type,
    )
  }

  const setPermLoading = (
    friendId: number | string,
    type: string,
    val: boolean,
  ): void =>
    setPermissionLoading((prev) => ({ ...prev, [`${friendId}:${type}`]: val }))

  const isPermLoading = (
    friendId: number | string | undefined,
    type: string,
  ): boolean => {
    if (friendId === undefined) return false
    return !!permissionLoading[`${friendId}:${type}`]
  }

  const handleGrantPermission = async (
    friend: Friend,
    type: string,
    payload: Record<string, unknown> | null = null,
  ) => {
    setPermLoading(friend.id, type, true)
    try {
      await sharingApi.grantPermission(
        friend.id,
        type as Parameters<typeof sharingApi.grantPermission>[1],
        payload,
      )
      await loadPermissions()
    } catch (e) {
      const err = e as Error
      alert(
        "Error",
        err.message || "Failed to grant permission",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setPermLoading(friend.id, type, false)
    }
  }

  const handleRevokePermission = async (friend: Friend, type: string) => {
    const perm = getGrantedPermission(friend.id, type)
    if (!perm) return
    setPermLoading(friend.id, type, true)
    try {
      await sharingApi.revokePermission(perm.id)
      await loadPermissions()
    } catch (e) {
      const err = e as Error
      alert(
        "Error",
        err.message || "Failed to revoke permission",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setPermLoading(friend.id, type, false)
    }
  }

  /**
   * Granting 'program' bundles the current workoutData into the payload.
   */
  const handleGrantProgramPermission = async (friend: Friend) => {
    if (!workoutData) {
      alert(
        "No Program Loaded",
        "Load a workout program first before sharing it.",
        [{ text: "OK" }],
        "info",
      )
      return
    }
    // Cast to access extra fields that may exist at runtime
    const wd = workoutData as unknown as {
      people?: string[]
      totalDays?: number
      days?: unknown[]
    }
    const payload: Record<string, unknown> = {
      programData: {
        name: `${wd.people?.join("/")} Program — ${wd.totalDays} Days`,
        totalDays: wd.totalDays,
        people: wd.people,
        days: wd.days,
      },
      message: null,
    }
    await handleGrantPermission(friend, "program", payload)
  }

  // ── Joint session helpers ─────────────────────────────────────────────────

  const getInviteStatusForFriend = (friendId: number | string): string => {
    if (isInJointSession) {
      const partnerInSession = (
        jointSession as unknown as {
          participants?: Array<{ userId: number | string }>
        }
      )?.participants?.find((p) => p.userId !== user?.id)
      return partnerInSession?.userId === friendId ? "active" : "idle"
    }
    if (inviteTargetId === friendId) return jointInviteStatus
    return "idle"
  }

  const handleSendInvite = async (friend: Friend) => {
    if (!hasOwnActiveSession) {
      alert(
        "Start a workout first",
        "You need to have an active workout session before inviting a friend.",
        [{ text: "OK" }],
        "info",
      )
      return
    }
    setInviteTargetId(friend.id)
    const ok = await sendJointInvite(String(friend.id))
    if (!ok) {
      setInviteTargetId(null)
      alert(
        "Error",
        "Could not send the invite. Try again.",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  useEffect(() => {
    if (jointInviteStatus === "idle" || jointInviteStatus === "active")
      setInviteTargetId(null)
  }, [jointInviteStatus])

  const handleAcceptInvite = async () => {
    if (!workoutStartTime) {
      alert(
        "Start your workout first",
        "Accept the invite after you've begun your own workout session.",
        [{ text: "OK" }],
        "info",
      )
      return
    }
    const ok = await acceptJointInvite()
    if (!ok)
      alert("Error", "Could not join the session.", [{ text: "OK" }], "error")
  }

  // ── Watch session ─────────────────────────────────────────────────────────

  const handleWatchSession = async (friend: Friend) => {
    if (!friend) return
    if (isWatching && watchTarget?.friendId === String(friend.id)) {
      alert(
        "Already Watching",
        `You're already watching ${friend.username}'s session. Switch to the Workout tab.`,
        [{ text: "OK" }],
        "info",
      )
      return
    }
    if (isWatching) stopWatching()

    setCheckingActiveSession(true)
    try {
      const activeSession = await sharingApi.getFriendActiveSession(friend.id)
      if (!activeSession) {
        alert(
          "No Active Session",
          `${friend.username} doesn't have an active workout session right now.`,
          [{ text: "OK" }],
          "info",
        )
        return
      }
      const sessionData = activeSession as { sessionId: string }
      const ok = await startWatching(
        String(friend.id),
        friend.username,
        sessionData.sessionId,
      )
      if (ok) {
        alert(
          "Watching 👀",
          `You're now watching ${friend.username}'s workout. Switch to the Workout tab to see it live.`,
          [{ text: "Go to Workout" }],
          "success",
        )
      } else {
        alert(
          "Session Ended",
          `${friend.username}'s session may have just ended.`,
          [{ text: "OK" }],
          "info",
        )
      }
    } catch (_err) {
      alert(
        "Error",
        "Could not load the live session. Try again.",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setCheckingActiveSession(false)
    }
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadFriends(), loadPermissions(), loadStats()])
    } catch (_error) {
      alert("Error", "Failed to load friends data", [{ text: "OK" }], "error")
    } finally {
      setLoading(false)
    }
  }

  const loadPermissions = async () => {
    const [granted, received] = await Promise.all([
      sharingApi.getGrantedPermissions().catch(() => [] as GrantedPermission[]),
      sharingApi
        .getReceivedPermissions()
        .catch(() => [] as ReceivedPermission[]),
    ])
    setGrantedPermissions(granted)
    setReceivedPermissions(received)
  }

  const loadStats = async () => {
    const stats = await sharingApi.getSharingStats().catch(() => null)
    setSharingStats(stats as Record<string, unknown> | null)
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await loadData()
    } catch (_) {
    } finally {
      setRefreshing(false)
    }
  }

  // ── Derived data from permissions ─────────────────────────────────────────

  const hasFriendSharedAnalyticsWith = (
    friendId: number | string | undefined,
  ): boolean => !!friendId && hasReceivedPermission(friendId, "analytics")

  const hasAlreadySharedAnalyticsWith = (
    friendId: number | string | undefined,
  ): boolean => !!friendId && !!getGrantedPermission(friendId, "analytics")

  const hasAlreadySharedProgramWith = (
    friendId: number | string | undefined,
  ): boolean => !!friendId && !!getGrantedPermission(friendId, "program")

  const receivedPrograms: ReceivedProgram[] = receivedPermissions
    .filter(
      (p) =>
        p.permissionType === "program" &&
        (p.payload as Record<string, unknown>)?.programData,
    )
    .map((p) => ({
      id: p.id,
      senderId: p.fromUserId,
      senderUsername: p.fromUsername,
      sharedAt: p.createdAt,
      message:
        ((p.payload as Record<string, unknown>)?.message as string) ?? null,
      programData: (p.payload as Record<string, unknown>)
        .programData as ProgramData,
    }))

  // ── Search ────────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await friendsApi.searchUsers(searchQuery.trim(), 10)
      setSearchResults((results || []) as UserSearchResult[])
    } catch (_error) {
      alert("Error", "Failed to search users", [{ text: "OK" }], "error")
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) handleSearch()
      else setSearchResults([])
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const sendFriendRequest = async (username: string) => {
    try {
      await friendsApi.sendFriendRequest(username)
      await loadFriends()
      setSearchQuery("")
      setSearchResults([])
    } catch (error) {
      const err = error as Error
      alert(
        "Error",
        err.message || "Failed to send friend request",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  const acceptFriendRequest = async (friendshipId: number | string) => {
    try {
      await friendsApi.acceptFriendRequest(friendshipId)
      await loadFriends()
    } catch (error) {
      const err = error as Error
      alert(
        "Error",
        err.message || "Failed to accept friend request",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  const rejectFriendRequest = async (
    friendshipId: number | string,
    username: string,
  ) => {
    alert(
      "Reject Request",
      `Reject friend request from ${username}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await friendsApi.rejectFriendRequest(friendshipId)
              await loadFriends()
            } catch (e) {
              const err = e as Error
              alert("Error", err.message || "Failed", [{ text: "OK" }], "error")
            }
          },
        },
      ],
      "warning",
    )
  }

  const removeFriend = async (friendId: number | string, username: string) => {
    alert(
      "Remove Friend",
      `Remove ${username} from your friends list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await friendsApi.removeFriend(friendId)
              await loadFriends()
            } catch (e) {
              const err = e as Error
              alert("Error", err.message || "Failed", [{ text: "OK" }], "error")
            }
          },
        },
      ],
      "warning",
    )
  }

  // ── Friend detail ─────────────────────────────────────────────────────────

  const loadFriendData = async (friend: Friend) => {
    setShowFriendDetailModal(true)
    setActiveFriendTab(
      hasFriendSharedAnalyticsWith(friend.id) ? "history" : "actions",
    )
    if (!hasFriendSharedAnalyticsWith(friend.id)) {
      setFriendSessionHistory([])
      setFriendSessionsWithTimings([])
      return
    }
    setLoadingFriendSessions(true)
    setFriendSessionsWithTimings([])
    try {
      const sessions = await sharingApi.getFriendSessions(friend.id, 60)
      setFriendSessionHistory((sessions || []) as SessionRecord[])
    } catch (_) {
      alert(
        "Error",
        "Failed to load friend's workout history",
        [{ text: "OK" }],
        "error",
      )
      setFriendSessionHistory([])
    } finally {
      setLoadingFriendSessions(false)
    }
  }

  const loadFriendAnalytics = async (
    friend: Friend,
    sessions: SessionRecord[],
  ) => {
    if (!friend || !sessions.length) return
    setLoadingAnalytics(true)
    try {
      const detailed = await Promise.all(
        sessions.map((s) =>
          sharingApi
            .getFriendSessionDetails(friend.id, s.id as number | string)
            .catch(() => ({ ...s, set_timings: [] })),
        ),
      )
      setFriendSessionsWithTimings(detailed as SessionRecord[])
    } catch (_) {
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const toLocalDateStr = (d: Date): string => {
    const y = d.getFullYear(),
      m = String(d.getMonth() + 1).padStart(2, "0"),
      dd = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${dd}`
  }
  const getSessionsForDate = (date: Date): SessionRecord[] => {
    const t = toLocalDateStr(date)
    return friendSessionHistory.filter(
      (s) => String(s.start_time).replace("T", " ").split(" ")[0] === t,
    )
  }
  const hasSessionOnDate = (date: Date): boolean =>
    getSessionsForDate(date).length > 0
  const handleDatePress = (date: Date) => {
    const s = getSessionsForDate(date)
    if (s.length === 1) handleSessionPress(s[0], selectedFriend)
    else if (s.length > 1) setSelectedDate(date)
  }

  const handleSessionPress = async (
    session: SessionRecord,
    friend: Friend | null = selectedFriend,
  ) => {
    if (!friend) {
      alert("Error", "Friend context lost.", [{ text: "OK" }], "error")
      return
    }
    try {
      const details = (await sharingApi.getFriendSessionDetails(
        friend.id,
        session.id as number | string,
      )) as SessionRecord
      if (details.set_timings && details.set_timings.length > 0) {
        const map = new Map<string, GroupedExercise>()
        details.set_timings.forEach((t) => {
          const k = t.exercise_name || `Exercise ${t.exercise_id ?? "?"}`
          if (!map.has(k)) map.set(k, { exerciseName: k, sets: [] })
          map.get(k)!.sets.push(t)
        })
        map.forEach((ex) => ex.sets.sort((a, b) => a.set_index - b.set_index))
        details.groupedExercises = Array.from(map.values())
      } else {
        details.groupedExercises = []
      }
      setSelectedSession(details)
      setSelectedDate(null)
      setShowSessionDetails(true)
    } catch (_) {
      alert(
        "Error",
        "Failed to load session details",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  const formatDate = (s: string): string =>
    new Date(s).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  const formatCalDate = (d: Date): string =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  const formatSessionTime = (s: string | number | undefined): string => {
    const p = String(s).replace("T", " ").split(" ")[1] || ""
    const [h, m] = p.split(":")
    const hr = parseInt(h)
    return `${hr % 12 || 12}:${m || "00"} ${hr >= 12 ? "PM" : "AM"}`
  }
  const formatTime = (sec: number | undefined): string => {
    if (!sec) return "N/A"
    const h = Math.floor(sec / 3600),
      m = Math.floor((sec % 3600) / 60),
      s = sec % 60
    if (h > 0) return `${h}h ${m}m`
    if (sec >= 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
    return `${sec}s`
  }
  const getSessionTitle = (s: SessionRecord | null): string => {
    if (!s?.day_title) return `Day ${s?.day_number ?? ""}`
    const p = s.day_title.split("—")
    return p.length > 1 ? p[1].trim() : s.day_title
  }

  // Extract pendingJointInvite as a typed invite banner prop
  const inviteForBanner: { fromUsername: string } | null = pendingJointInvite
    ? {
        fromUsername:
          (pendingJointInvite as unknown as { fromUsername: string })
            .fromUsername ?? "",
      }
    : null

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <ActivityIndicator size='large' color='#667eea' />
        <Text style={styles.loadingText}>Loading friends...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <InviteBanner
        invite={inviteForBanner}
        onAccept={handleAcceptInvite}
        onDecline={declineJointInvite}
      />

      {isInJointSession && (
        <View style={styles.activeSessionPill}>
          <View style={styles.liveIndicator} />
          <Text style={styles.activeSessionText}>Joint session active</Text>
          <TouchableOpacity onPress={leaveJointSession}>
            <Text style={styles.leaveText}>Leave</Text>
          </TouchableOpacity>
        </View>
      )}

      {isWatching && (
        <View style={[styles.activeSessionPill, watchStyles.pill]}>
          <Text style={watchStyles.pillIcon}>👀</Text>
          <Text style={watchStyles.pillText}>
            Watching {watchTarget?.friendUsername}
          </Text>
          <TouchableOpacity onPress={stopWatching}>
            <Text style={styles.leaveText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor='#667eea'
          />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>👥 Friends</Text>
            <Text style={styles.subtitle}>
              Connect and share your fitness journey
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { key: "friends", icon: "👥", label: "Friends" },
                { key: "requests", icon: "📬", label: "Requests" },
                { key: "search", icon: "🔍", label: "Search" },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tab,
                    activeTab === tab.key && styles.tabActive,
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={styles.tabIcon}>{tab.icon}</Text>
                  <Text
                    style={[
                      styles.tabLabel,
                      activeTab === tab.key && styles.tabLabelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {tab.key === "requests" && pendingRequests.length > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {pendingRequests.length}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Friends tab ── */}
          {activeTab === "friends" && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Your Friends ({friends.length})
                </Text>
              </View>
              {friends.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>👋</Text>
                  <Text style={styles.emptyTitle}>No friends yet</Text>
                  <Text style={styles.emptyText}>
                    Search for users to add friends and share your progress
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => setActiveTab("search")}
                  >
                    <Text style={styles.emptyButtonText}>Find Friends</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {friends.map((friend) => {
                    const friendIsWorkingOut =
                      !!friendSessionStatuses[friend.id]
                    const cardStatus = getInviteStatusForFriend(friend.id)
                    const showLiftButton =
                      hasOwnActiveSession &&
                      friendIsWorkingOut &&
                      cardStatus !== "active"
                    const isBeingWatched =
                      isWatching && watchTarget?.friendId === String(friend.id)

                    return (
                      <TouchableOpacity
                        key={String(friend.id)}
                        style={[
                          styles.friendCard,
                          friendIsWorkingOut && styles.friendCardActive,
                          isBeingWatched && watchStyles.friendCardWatched,
                        ]}
                        onPress={() => {
                          setSelectedFriend(friend)
                          loadFriendData(friend)
                        }}
                        activeOpacity={0.85}
                      >
                        <View style={styles.friendInfo}>
                          <View
                            style={[
                              styles.avatar,
                              friendIsWorkingOut && styles.avatarActive,
                            ]}
                          >
                            <Text style={styles.avatarText}>
                              {friend.username?.charAt(0).toUpperCase() || "?"}
                            </Text>
                            {friendIsWorkingOut && (
                              <View style={styles.workingOutDot} />
                            )}
                          </View>
                          <View style={styles.friendDetails}>
                            <Text style={styles.friendName}>
                              {friend.username}
                            </Text>
                            <Text style={styles.friendMeta}>
                              {isBeingWatched
                                ? "👀 Watching their session"
                                : friendIsWorkingOut
                                  ? "🏋️ Working out now"
                                  : `Friends since ${formatDate(friend.createdAt)}`}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.friendCardRight}>
                          {showLiftButton && (
                            <LiftTogetherButton
                              small
                              status={cardStatus}
                              onPress={() => handleSendInvite(friend)}
                            />
                          )}
                          {cardStatus === "active" && (
                            <View
                              style={[
                                liftStyles.button,
                                liftStyles.buttonSmall,
                                { backgroundColor: colors.success },
                              ]}
                            >
                              <Text style={liftStyles.labelSmall}>
                                ✓ Together
                              </Text>
                            </View>
                          )}
                          <Text style={styles.chevronRight}>›</Text>
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </View>
          )}

          {/* ── Requests tab ── */}
          {activeTab === "requests" && (
            <View style={styles.section}>
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>
                  Pending Requests ({pendingRequests.length})
                </Text>
                {pendingRequests.length === 0 ? (
                  <View style={styles.emptyStateSmall}>
                    <Text style={styles.emptyTextSmall}>
                      No pending friend requests
                    </Text>
                  </View>
                ) : (
                  <View style={styles.listContainer}>
                    {pendingRequests.map((request) => (
                      <View key={String(request.id)} style={styles.requestCard}>
                        <View style={styles.friendInfo}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {request.senderUsername
                                ?.charAt(0)
                                .toUpperCase() || "?"}
                            </Text>
                          </View>
                          <View style={styles.friendDetails}>
                            <Text style={styles.friendName}>
                              {request.senderUsername}
                            </Text>
                            <Text style={styles.friendMeta}>
                              Sent {formatDate(request.createdAt)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.requestActions}>
                          <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => acceptFriendRequest(request.id)}
                          >
                            <Text style={styles.acceptButtonText}>✓</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectButton}
                            onPress={() =>
                              rejectFriendRequest(
                                request.id,
                                request.senderUsername,
                              )
                            }
                          >
                            <Text style={styles.rejectButtonText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>
                  Sent Requests ({sentRequests.length})
                </Text>
                {sentRequests.length === 0 ? (
                  <View style={styles.emptyStateSmall}>
                    <Text style={styles.emptyTextSmall}>
                      No sent friend requests
                    </Text>
                  </View>
                ) : (
                  <View style={styles.listContainer}>
                    {sentRequests.map((request) => (
                      <View
                        key={String(request.id)}
                        style={styles.sentRequestCard}
                      >
                        <View style={styles.friendInfo}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {request.receiverUsername
                                ?.charAt(0)
                                .toUpperCase() || "?"}
                            </Text>
                          </View>
                          <View style={styles.friendDetails}>
                            <Text style={styles.friendName}>
                              {request.receiverUsername}
                            </Text>
                            <Text style={styles.friendMeta}>
                              Sent {formatDate(request.createdAt)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusBadgeText}>Pending</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Search tab ── */}
          {activeTab === "search" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Find Friends</Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder='Search by username...'
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize='none'
                  autoCorrect={false}
                />
                {searching && (
                  <ActivityIndicator
                    style={styles.searchLoader}
                    size='small'
                    color='#667eea'
                  />
                )}
              </View>
              {searchResults.length > 0 ? (
                <View style={styles.listContainer}>
                  {searchResults.map((result) => {
                    const isFriend = friends.some((f) => f.id === result.id)
                    const hasSent = sentRequests.some(
                      (r) => r.receiverId === result.id,
                    )
                    const hasPending = pendingRequests.some(
                      (r) => r.senderId === result.id,
                    )
                    return (
                      <View
                        key={String(result.id)}
                        style={styles.searchResultCard}
                      >
                        <View style={styles.friendInfo}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {result.username?.charAt(0).toUpperCase() || "?"}
                            </Text>
                          </View>
                          <View style={styles.friendDetails}>
                            <Text style={styles.friendName}>
                              {result.username}
                            </Text>
                            {result.email && (
                              <Text style={styles.friendMeta}>
                                {result.email}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.searchResultActions}>
                          {result.id === user?.id ? (
                            <View style={styles.statusBadge}>
                              <Text style={styles.statusBadgeText}>You</Text>
                            </View>
                          ) : isFriend ? (
                            <View
                              style={[
                                styles.statusBadge,
                                styles.statusBadgeFriend,
                              ]}
                            >
                              <Text style={styles.statusBadgeText}>
                                ✓ Friends
                              </Text>
                            </View>
                          ) : hasSent ? (
                            <View style={styles.statusBadge}>
                              <Text style={styles.statusBadgeText}>
                                Pending
                              </Text>
                            </View>
                          ) : hasPending ? (
                            <TouchableOpacity
                              style={styles.respondButton}
                              onPress={() => setActiveTab("requests")}
                            >
                              <Text style={styles.respondButtonText}>
                                Respond
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={styles.addButton}
                              onPress={() => sendFriendRequest(result.username)}
                            >
                              <Text style={styles.addButtonText}>
                                + Add Friend
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )
                  })}
                </View>
              ) : searchQuery.trim() && !searching ? (
                <View style={styles.emptyStateSmall}>
                  <Text style={styles.emptyTextSmall}>No users found</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Friend Detail Modal ── */}
      <ModalSheet
        visible={showFriendDetailModal}
        fullHeight={true}
        showCancelButton={false}
        showConfirmButton={false}
        onClose={() => {
          setShowFriendDetailModal(false)
          setSelectedFriend(null)
          setFriendSessionHistory([])
          setFriendSessionsWithTimings([])
          setSelectedDate(null)
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setShowFriendDetailModal(false)
                setSelectedFriend(null)
                setFriendSessionHistory([])
                setFriendSessionsWithTimings([])
                setSelectedDate(null)
              }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>
              {selectedFriend?.username || ""}
            </Text>
            <View style={styles.backButton} />
          </View>

          {/* ── Friend tabs ── */}
          <View style={styles.friendTabContainer}>
            {(() => {
              const hasAnalytics = hasFriendSharedAnalyticsWith(
                selectedFriend?.id,
              )
              const hasProgramFromFriend = receivedPrograms.some(
                (p) => p.senderId === selectedFriend?.id,
              )
              const hasWatch = hasReceivedPermission(
                selectedFriend?.id,
                "watch_session",
              )

              return [
                { key: "history", label: "📅 History", locked: !hasAnalytics },
                {
                  key: "analytics",
                  label: "📊 Analytics",
                  locked: !hasAnalytics,
                },
                {
                  key: "program",
                  label: "📋 Program",
                  locked: !hasProgramFromFriend,
                },
                { key: "live", label: "🔴 Live", locked: !hasWatch },
                { key: "actions", label: "⚙️ Actions", locked: false },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.friendTab,
                    activeFriendTab === tab.key && styles.friendTabActive,
                    tab.locked && { opacity: 0.35 },
                  ]}
                  onPress={() => {
                    if (tab.locked) {
                      const msg =
                        tab.key === "program"
                          ? `${selectedFriend?.username} hasn't shared a program with you yet.`
                          : tab.key === "live"
                            ? `${selectedFriend?.username} hasn't granted you Watch Session permission yet.`
                            : `${selectedFriend?.username} hasn't granted you analytics access yet.`
                      alert("Not Available", msg, [{ text: "OK" }], "lock")
                      return
                    }
                    setActiveFriendTab(tab.key)
                    if (
                      tab.key === "analytics" &&
                      friendSessionsWithTimings.length === 0 &&
                      !loadingAnalytics &&
                      friendSessionHistory.length > 0 &&
                      selectedFriend
                    )
                      loadFriendAnalytics(selectedFriend, friendSessionHistory)
                  }}
                >
                  <Text
                    style={[
                      styles.friendTabText,
                      activeFriendTab === tab.key && styles.friendTabTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                    {tab.locked ? " 🔒" : ""}
                  </Text>
                </TouchableOpacity>
              ))
            })()}
          </View>

          {/* ── History tab ── */}
          {activeFriendTab === "history" &&
            (!hasFriendSharedAnalyticsWith(selectedFriend?.id) ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔒</Text>
                <Text style={styles.emptyTitle}>Not shared yet</Text>
                <Text style={styles.emptyText}>
                  {selectedFriend?.username} hasn't granted you analytics
                  access.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll}>
                <View style={styles.friendDetailContent}>
                  <View style={styles.workoutHistorySection}>
                    <Text style={styles.sectionTitleLarge}>
                      📅 Workout History
                    </Text>
                    {loadingFriendSessions ? (
                      <View style={styles.calendarLoading}>
                        <ActivityIndicator size='large' color='#667eea' />
                      </View>
                    ) : (
                      <>
                        <Text style={styles.calendarHint}>
                          Tap a date to view workout details
                        </Text>
                        <UniversalCalendar
                          hasDataOnDate={hasSessionOnDate}
                          onDatePress={handleDatePress}
                          initialView='month'
                          dotColor='#10b981'
                          legendText='Workout day'
                        />
                      </>
                    )}
                  </View>
                </View>
              </ScrollView>
            ))}

          {/* ── Analytics tab ── */}
          {activeFriendTab === "analytics" &&
            (loadingAnalytics ? (
              <View style={styles.analyticsLoading}>
                <ActivityIndicator size='large' color='#667eea' />
                <Text style={styles.analyticsLoadingText}>
                  Loading exercise data...
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <ExerciseAnalytics
                  sessions={
                    friendSessionsWithTimings as Parameters<
                      typeof ExerciseAnalytics
                    >[0]["sessions"]
                  }
                  workoutData={null}
                  selectedPerson={null}
                  title={`📊 ${selectedFriend?.username}'s Analytics`}
                  isDemoMode={false}
                  completedDays={{}}
                  currentBodyWeight={null}
                />
              </View>
            ))}

          {/* ── Program tab ── */}
          {activeFriendTab === "program" &&
            (() => {
              const programsFromFriend = receivedPrograms.filter(
                (p) => p.senderId === selectedFriend?.id,
              )
              if (!programsFromFriend.length)
                return (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🔒</Text>
                    <Text style={styles.emptyTitle}>No program shared</Text>
                    <Text style={styles.emptyText}>
                      {selectedFriend?.username} hasn't shared a program with
                      you.
                    </Text>
                  </View>
                )
              const program = programsFromFriend[0]
              const pd = program.programData
              const people = pd?.days?.[0]?.exercises?.[0]?.setsByPerson
                ? Object.keys(pd.days[0].exercises[0].setsByPerson)
                : []
              const allOptions = ["All", ...people]
              return (
                <View style={{ flex: 1 }}>
                  <View style={styles.peopleSelectorContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.peopleSelectorScroll}
                    >
                      {allOptions.map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.peoplePill,
                            (selectedProgram === option ||
                              (option === "All" && !selectedProgram)) &&
                              styles.peoplePillActive,
                          ]}
                          onPress={() =>
                            setSelectedProgram(option === "All" ? null : option)
                          }
                        >
                          <Text
                            style={[
                              styles.peoplePillText,
                              (selectedProgram === option ||
                                (option === "All" && !selectedProgram)) &&
                                styles.peoplePillTextActive,
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                  >
                    <View style={styles.programViewHeader}>
                      <Text style={styles.programViewTitle}>
                        {pd?.name || "Shared Program"}
                      </Text>
                      <Text style={styles.programViewMeta}>
                        {pd?.totalDays} days
                        {people.length ? ` • ${people.join(" / ")}` : ""}
                      </Text>
                      <Text style={styles.programViewShared}>
                        Shared {formatDate(program.sharedAt)}
                      </Text>
                    </View>
                    {Array.isArray(pd?.days) &&
                      pd.days!.map((day, dayIdx) => {
                        const exercises = Array.isArray(day.exercises)
                          ? day.exercises.filter(
                              (ex) =>
                                !selectedProgram ||
                                (ex.setsByPerson?.[selectedProgram] ?? 0) > 0,
                            )
                          : []
                        if (!exercises.length) return null
                        return (
                          <View key={dayIdx} style={styles.programDayCard}>
                            <View style={styles.programDayHeader}>
                              <Text style={styles.programDayNumber}>
                                Day {day.dayNumber ?? dayIdx + 1}
                              </Text>
                              <Text
                                style={styles.programDayTitle}
                                numberOfLines={2}
                              >
                                {day.dayTitle
                                  ? day.dayTitle.includes("—")
                                    ? day.dayTitle.split("—")[1].trim()
                                    : day.dayTitle
                                  : ""}
                              </Text>
                            </View>
                            {exercises.map((exercise, exIdx) => {
                              const setsByPerson = exercise.setsByPerson ?? {}
                              const personEntries: Array<[string, number]> =
                                selectedProgram
                                  ? [
                                      [
                                        selectedProgram,
                                        setsByPerson[selectedProgram] ?? 0,
                                      ],
                                    ]
                                  : Object.entries(setsByPerson)
                              return (
                                <View
                                  key={exIdx}
                                  style={styles.programExerciseRow}
                                >
                                  <View style={styles.programExerciseLeft}>
                                    <Text style={styles.programExerciseName}>
                                      {exercise.name ?? `Exercise ${exIdx + 1}`}
                                    </Text>
                                    {exercise.muscleGroup ? (
                                      <Text style={styles.programExerciseSets}>
                                        {exercise.muscleGroup}
                                      </Text>
                                    ) : null}
                                  </View>
                                  <View style={styles.programSetsRow}>
                                    {personEntries.map(([person, count]) => (
                                      <View
                                        key={person}
                                        style={styles.programSetsBadge}
                                      >
                                        <Text
                                          style={styles.programSetsBadgeText}
                                        >
                                          {count}
                                        </Text>
                                        <Text
                                          style={styles.programSetsBadgeLabel}
                                        >
                                          {person}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              )
                            })}
                          </View>
                        )
                      })}
                  </ScrollView>
                </View>
              )
            })()}

          {/* ── Live tab ── */}
          {activeFriendTab === "live" && (
            <LiveSessionTab
              friend={
                selectedFriend
                  ? ({
                      ...selectedFriend,
                      id: String(selectedFriend.id),
                    } as unknown as Parameters<
                      typeof LiveSessionTab
                    >[0]["friend"])
                  : (null as unknown as Parameters<
                      typeof LiveSessionTab
                    >[0]["friend"])
              }
              isVisible={activeFriendTab === "live" && showFriendDetailModal}
              receivedPrograms={
                receivedPrograms.map((p) => ({
                  ...p,
                  senderId: String(p.senderId),
                })) as unknown as Parameters<
                  typeof LiveSessionTab
                >[0]["receivedPrograms"]
              }
              socketLastMessage={socketLastMessage}
            />
          )}

          {/* ── Actions tab ── */}
          {activeFriendTab === "actions" && (
            <ScrollView style={styles.modalScroll}>
              <View style={styles.actionsTabContent}>
                {/* ═══ Permissions I've Granted ════════════════════════════ */}
                <Text style={styles.actionsTabSectionTitle}>
                  Permissions for {selectedFriend?.username}
                </Text>
                <Text style={styles.actionsTabSectionHint}>
                  Control what {selectedFriend?.username} is allowed to see and
                  do.
                </Text>

                <PermissionRow
                  icon='📅'
                  title='History Access'
                  description={`Let ${selectedFriend?.username} view your workout history calendar and session details.`}
                  granted={
                    !!getGrantedPermission(
                      selectedFriend?.id as number | string,
                      "history",
                    )
                  }
                  loading={isPermLoading(selectedFriend?.id, "history")}
                  onGrant={() =>
                    selectedFriend &&
                    handleGrantPermission(selectedFriend, "history")
                  }
                  onRevoke={() =>
                    selectedFriend &&
                    handleRevokePermission(selectedFriend, "history")
                  }
                />

                <PermissionRow
                  icon='📊'
                  title='Analytics Access'
                  description={`Let ${selectedFriend?.username} view your workout analytics and progress charts.`}
                  granted={
                    !!getGrantedPermission(
                      selectedFriend?.id as number | string,
                      "analytics",
                    )
                  }
                  loading={isPermLoading(selectedFriend?.id, "analytics")}
                  onGrant={() =>
                    selectedFriend &&
                    handleGrantPermission(selectedFriend, "analytics")
                  }
                  onRevoke={() =>
                    selectedFriend &&
                    handleRevokePermission(selectedFriend, "analytics")
                  }
                />

                <PermissionRow
                  icon='📋'
                  title='Share My Program'
                  description={
                    workoutData
                      ? (() => {
                          const wd = workoutData as unknown as {
                            people?: string[]
                            totalDays?: number
                          }
                          return `Share your current program (${wd.people?.join("/")} — ${wd.totalDays} days) with ${selectedFriend?.username}.`
                        })()
                      : `No program loaded. Load a workout program first to share it.`
                  }
                  granted={
                    !!getGrantedPermission(
                      selectedFriend?.id as number | string,
                      "program",
                    )
                  }
                  loading={isPermLoading(selectedFriend?.id, "program")}
                  onGrant={() =>
                    selectedFriend &&
                    handleGrantProgramPermission(selectedFriend)
                  }
                  onRevoke={() =>
                    selectedFriend &&
                    handleRevokePermission(selectedFriend, "program")
                  }
                />

                <PermissionRow
                  icon='🏋️'
                  title='Joint Session'
                  description={`Let ${selectedFriend?.username} invite you to lift together when you're both working out.`}
                  granted={
                    !!getGrantedPermission(
                      selectedFriend?.id as number | string,
                      "joint_session",
                    )
                  }
                  loading={isPermLoading(selectedFriend?.id, "joint_session")}
                  onGrant={() =>
                    selectedFriend &&
                    handleGrantPermission(selectedFriend, "joint_session")
                  }
                  onRevoke={() =>
                    selectedFriend &&
                    handleRevokePermission(selectedFriend, "joint_session")
                  }
                />

                <PermissionRow
                  icon='👀'
                  title='Watch Session'
                  description={`Let ${selectedFriend?.username} watch your active workout session live.`}
                  granted={
                    !!getGrantedPermission(
                      selectedFriend?.id as number | string,
                      "watch_session",
                    )
                  }
                  loading={isPermLoading(selectedFriend?.id, "watch_session")}
                  onGrant={() =>
                    selectedFriend &&
                    handleGrantPermission(selectedFriend, "watch_session")
                  }
                  onRevoke={() =>
                    selectedFriend &&
                    handleRevokePermission(selectedFriend, "watch_session")
                  }
                />

                {/* ═══ Their permissions for me (read-only) ════════════════ */}
                <Text
                  style={[styles.actionsTabSectionTitle, { marginTop: 28 }]}
                >
                  {selectedFriend?.username}'s Permissions for You
                </Text>
                <Text style={styles.actionsTabSectionHint}>
                  What {selectedFriend?.username} has allowed you to do.
                </Text>

                {[
                  { type: "history", icon: "📅", label: "History Access" },
                  { type: "analytics", icon: "📊", label: "Analytics Access" },
                  { type: "program", icon: "📋", label: "Shared Program" },
                  { type: "joint_session", icon: "🏋️", label: "Joint Session" },
                  { type: "watch_session", icon: "👀", label: "Watch Session" },
                ].map(({ type, icon, label }) => {
                  const has = hasReceivedPermission(selectedFriend?.id, type)
                  return (
                    <View
                      key={type}
                      style={[
                        permStyles.row,
                        has ? permStyles.rowGranted : { opacity: 0.5 },
                      ]}
                    >
                      <Text style={permStyles.icon}>{icon}</Text>
                      <View style={permStyles.text}>
                        <Text style={permStyles.title}>{label}</Text>
                        <Text style={permStyles.desc}>
                          {has
                            ? `${selectedFriend?.username} has granted you this.`
                            : `${selectedFriend?.username} hasn't granted this yet.`}
                        </Text>
                      </View>
                      <View
                        style={[
                          permStyles.grantBtn,
                          {
                            backgroundColor: has
                              ? colors.successLight
                              : colors.separator,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            permStyles.grantBtnText,
                            { color: has ? colors.success : colors.textMuted },
                          ]}
                        >
                          {has ? "✓ Granted" : "Not yet"}
                        </Text>
                      </View>
                    </View>
                  )
                })}

                {/* ═══ Live Session (watch) ════════════════════════════════ */}
                {hasReceivedPermission(selectedFriend?.id, "watch_session") && (
                  <>
                    <Text
                      style={[styles.actionsTabSectionTitle, { marginTop: 28 }]}
                    >
                      Live Session
                    </Text>
                    {(() => {
                      const friendActive =
                        !!friendSessionStatuses[
                          selectedFriend?.id as number | string
                        ]
                      const alreadyWatchingThis =
                        isWatching &&
                        watchTarget?.friendId === String(selectedFriend?.id)

                      if (alreadyWatchingThis)
                        return (
                          <View
                            style={[styles.actionRow, watchStyles.activeRow]}
                          >
                            <Text style={styles.actionRowIcon}>👀</Text>
                            <View style={styles.actionRowText}>
                              <Text
                                style={[
                                  styles.actionRowTitle,
                                  { color: colors.info },
                                ]}
                              >
                                Watching Now
                              </Text>
                              <Text style={styles.actionRowSub}>
                                Switch to the Workout tab to see{" "}
                                {selectedFriend?.username}'s live session.
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={watchStyles.stopBtn}
                              onPress={stopWatching}
                            >
                              <Text style={watchStyles.stopBtnText}>Stop</Text>
                            </TouchableOpacity>
                          </View>
                        )

                      if (!friendActive)
                        return (
                          <View style={[styles.actionRow, { opacity: 0.55 }]}>
                            <Text style={styles.actionRowIcon}>👀</Text>
                            <View style={styles.actionRowText}>
                              <Text style={styles.actionRowTitle}>
                                View Current Session
                              </Text>
                              <Text style={styles.actionRowSub}>
                                {selectedFriend?.username} isn't working out
                                right now.
                              </Text>
                            </View>
                          </View>
                        )

                      return (
                        <TouchableOpacity
                          style={[
                            styles.actionRow,
                            watchStyles.availableRow,
                            checkingActiveSession && { opacity: 0.7 },
                          ]}
                          onPress={() =>
                            selectedFriend && handleWatchSession(selectedFriend)
                          }
                          disabled={checkingActiveSession}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.actionRowIcon}>👀</Text>
                          <View style={styles.actionRowText}>
                            <Text
                              style={[
                                styles.actionRowTitle,
                                { color: colors.info },
                              ]}
                            >
                              View Current Session
                            </Text>
                            <Text style={styles.actionRowSub}>
                              {selectedFriend?.username} is working out now —
                              watch their session live.
                            </Text>
                          </View>
                          {checkingActiveSession ? (
                            <ActivityIndicator size='small' color='#2563eb' />
                          ) : (
                            <Text
                              style={[
                                styles.actionRowArrow,
                                { color: colors.info },
                              ]}
                            >
                              ›
                            </Text>
                          )}
                        </TouchableOpacity>
                      )
                    })()}
                  </>
                )}

                {/* ═══ Lift Together ════════════════════════════════════════ */}
                {hasOwnActiveSession &&
                  hasReceivedPermission(
                    selectedFriend?.id,
                    "joint_session",
                  ) && (
                    <>
                      <Text
                        style={[
                          styles.actionsTabSectionTitle,
                          { marginTop: 28 },
                        ]}
                      >
                        Lift Together
                      </Text>
                      {(() => {
                        const friendActive =
                          !!friendSessionStatuses[
                            selectedFriend?.id as number | string
                          ]
                        const cs = getInviteStatusForFriend(
                          selectedFriend?.id as number | string,
                        )

                        if (isInJointSession && cs === "active")
                          return (
                            <View
                              style={[styles.actionRow, jointStyles.activeRow]}
                            >
                              <View style={jointStyles.liveDot} />
                              <View style={styles.actionRowText}>
                                <Text
                                  style={[
                                    styles.actionRowTitle,
                                    { color: colors.success },
                                  ]}
                                >
                                  Joint session active 🎉
                                </Text>
                                <Text style={styles.actionRowSub}>
                                  Your sets are synced – open the Workout tab.
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={jointStyles.leaveBtn}
                                onPress={leaveJointSession}
                              >
                                <Text style={jointStyles.leaveBtnText}>
                                  Leave
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )

                        if (!friendActive)
                          return (
                            <View style={[styles.actionRow, { opacity: 0.6 }]}>
                              <Text style={styles.actionRowIcon}>🏋️</Text>
                              <View style={styles.actionRowText}>
                                <Text style={styles.actionRowTitle}>
                                  Lift Together
                                </Text>
                                <Text style={styles.actionRowSub}>
                                  {selectedFriend?.username} is not currently in
                                  a workout session.
                                </Text>
                              </View>
                            </View>
                          )

                        return (
                          <TouchableOpacity
                            style={[
                              styles.actionRow,
                              jointStyles.inviteRow,
                              cs === "waiting" && { opacity: 0.7 },
                            ]}
                            onPress={() =>
                              selectedFriend && handleSendInvite(selectedFriend)
                            }
                            disabled={cs === "sending" || cs === "waiting"}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.actionRowIcon}>🏋️</Text>
                            <View style={styles.actionRowText}>
                              <Text
                                style={[
                                  styles.actionRowTitle,
                                  { color: colors.accentDark },
                                ]}
                              >
                                {cs === "waiting"
                                  ? "Waiting for response…"
                                  : "Invite to Lift Together"}
                              </Text>
                              <Text style={styles.actionRowSub}>
                                {selectedFriend?.username} is working out. Sync
                                up!
                              </Text>
                            </View>
                            {cs === "sending" || cs === "waiting" ? (
                              <ActivityIndicator size='small' color='#7c3aed' />
                            ) : (
                              <Text
                                style={[
                                  styles.actionRowArrow,
                                  { color: colors.accentDark },
                                ]}
                              >
                                ›
                              </Text>
                            )}
                          </TouchableOpacity>
                        )
                      })()}
                    </>
                  )}

                {/* ═══ Danger Zone ══════════════════════════════════════════ */}
                <Text
                  style={[styles.actionsTabSectionTitle, { marginTop: 28 }]}
                >
                  Danger Zone
                </Text>
                <TouchableOpacity
                  style={[styles.actionRow, styles.actionRowDanger]}
                  onPress={() => {
                    if (!selectedFriend) return
                    setShowFriendDetailModal(false)
                    setSelectedFriend(null)
                    setFriendSessionHistory([])
                    setFriendSessionsWithTimings([])
                    removeFriend(selectedFriend.id, selectedFriend.username)
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionRowIcon}>🚫</Text>
                  <View style={styles.actionRowText}>
                    <Text
                      style={[styles.actionRowTitle, { color: colors.error }]}
                    >
                      Remove Friend
                    </Text>
                    <Text style={styles.actionRowSub}>
                      Remove {selectedFriend?.username} from your friends list
                    </Text>
                  </View>
                  <Text
                    style={[styles.actionRowArrow, { color: colors.error }]}
                  >
                    ›
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </ModalSheet>

      {/* ── Date session picker modal ── */}
      <ModalSheet
        visible={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatCalDate(selectedDate) : ""}
        showCancelButton={false}
        showConfirmButton={false}
        scrollable={true}
      >
        {selectedDate &&
          getSessionsForDate(selectedDate).map((session) => (
            <TouchableOpacity
              key={String(session.id)}
              style={styles.sessionListItem}
              onPress={() => handleSessionPress(session, selectedFriend)}
            >
              <View style={styles.sessionListLeft}>
                <Text style={styles.sessionListTitle}>
                  {`Day ${session.day_number} - ${getSessionTitle(session)}`}
                </Text>
                <View style={styles.sessionListMeta}>
                  <Text style={styles.sessionListTime}>
                    {`⏱️ ${formatSessionTime(session.start_time)}`}
                  </Text>
                  {!!session.total_duration && (
                    <Text style={styles.sessionListDuration}>
                      {` • ${formatTime(session.total_duration)}`}
                    </Text>
                  )}
                  <Text style={styles.sessionListSets}>
                    {` • ${session.completed_sets} sets`}
                  </Text>
                </View>
              </View>
              <Text style={styles.sessionListArrow}>›</Text>
            </TouchableOpacity>
          ))}
      </ModalSheet>

      {/* ── Session details modal ── */}
      <ModalSheet
        visible={showSessionDetails}
        onClose={() => {
          setShowSessionDetails(false)
          setSelectedSession(null)
        }}
        title='Session Details'
        scrollable={true}
        showCancelButton={false}
        showConfirmButton={false}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setShowSessionDetails(false)
                setSelectedSession(null)
              }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Workout Details</Text>
            <View style={styles.backButton} />
          </View>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.sessionDetailsContent}>
              {selectedSession && (
                <>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>
                      Day {selectedSession.day_number}
                    </Text>
                    <Text style={styles.detailSubtitle}>
                      {getSessionTitle(selectedSession)}
                    </Text>
                    {Array.isArray(selectedSession.muscle_groups) &&
                      selectedSession.muscle_groups.length > 0 && (
                        <View style={styles.muscleGroupsRow}>
                          {selectedSession.muscle_groups.map((g, i) => (
                            <View key={i} style={styles.muscleTag}>
                              <Text style={styles.muscleTagText}>
                                {String(g)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                  </View>
                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue}>
                        {new Date(
                          selectedSession.start_time as string | number,
                        ).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Duration</Text>
                      <Text style={styles.detailValue}>
                        {formatTime(selectedSession.total_duration)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Sets Completed</Text>
                      <Text style={styles.detailValue}>
                        {selectedSession.completed_sets ?? 0}
                      </Text>
                    </View>
                  </View>
                  {Array.isArray(selectedSession.groupedExercises) &&
                    selectedSession.groupedExercises.length > 0 && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Exercises</Text>
                        {selectedSession.groupedExercises.map(
                          (exercise, ei) => (
                            <View key={ei} style={styles.exerciseCard}>
                              <View style={styles.exerciseHeader}>
                                <Text style={styles.exerciseName}>
                                  {exercise.exerciseName}
                                </Text>
                                <Text style={styles.exerciseSetsCount}>
                                  {exercise.sets.length} sets
                                </Text>
                              </View>
                              {exercise.sets.map((set, si) => (
                                <View key={si} style={styles.setTimingCard}>
                                  <Text style={styles.setTimingTitle}>
                                    Set {set.set_index + 1}
                                  </Text>
                                  <Text style={styles.setTimingDetail}>
                                    {parseFloat(String(set.weight ?? 0))}kg ×{" "}
                                    {parseInt(String(set.reps ?? 0))}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ),
                        )}
                      </View>
                    )}
                </>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ModalSheet>

      {AlertComponent}
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Watch session styles
// ─────────────────────────────────────────────────────────────────────────────
const makeWatchStyles = (colors: any) =>
  StyleSheet.create({
    pill: {
      backgroundColor: colors.infoLight,
      borderBottomColor: colors.surfaceBorder,
    },
    pillIcon: { fontSize: 16 },
    pillText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.info },
    friendCardWatched: {
      borderWidth: 2,
      borderColor: colors.info,
      backgroundColor: colors.infoLight,
    },
    activeRow: {
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    availableRow: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.infoLight,
    },
    stopBtn: {
      backgroundColor: colors.errorLight,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
    },
    stopBtnText: { color: colors.error, fontSize: 13, fontWeight: "600" },
  })

// ─────────────────────────────────────────────────────────────────────────────
// Joint session styles
// ─────────────────────────────────────────────────────────────────────────────
const makeJointStyles = (colors: any) =>
  StyleSheet.create({
    activeRow: {
      backgroundColor: "#ecfdf5",
      borderWidth: 1,
      borderColor: "#6ee7b7",
    },
    inviteRow: {
      borderWidth: 1,
      borderColor: "#ddd6fe",
      backgroundColor: "#faf5ff",
    },
    liveDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.success,
      marginRight: 14,
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
      elevation: 3,
    },
    leaveBtn: {
      backgroundColor: colors.errorLight,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
    },
    leaveBtnText: { color: colors.error, fontSize: 13, fontWeight: "600" },
  })

// ─────────────────────────────────────────────────────────────────────────────
// Base styles
// ─────────────────────────────────────────────────────────────────────────────
const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 60, paddingBottom: 120 },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: { marginTop: 12, color: colors.textSecondary, fontSize: 16 },
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
    tabContainer: { marginBottom: 20 },
    tab: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      marginRight: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      position: "relative",
    },
    tabActive: { backgroundColor: colors.accent },
    tabIcon: { fontSize: 20, marginRight: 8 },
    tabLabel: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    tabLabelActive: { color: colors.surface },
    badge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: colors.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6,
    },
    badgeText: { color: colors.surface, fontSize: 11, fontWeight: "bold" },
    section: { marginBottom: 25 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    subsection: { marginBottom: 20 },
    subsectionTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    listContainer: { gap: 12 },
    friendCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    friendCardActive: {
      borderWidth: 2,
      borderColor: colors.info,
      backgroundColor: "#faf5ff",
    },
    friendCardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    friendInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      position: "relative",
    },
    avatarActive: { backgroundColor: colors.accentDark },
    workingOutDot: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    avatarText: { color: colors.surface, fontSize: 20, fontWeight: "bold" },
    friendDetails: { flex: 1 },
    friendName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    friendMeta: { fontSize: 13, color: colors.textMuted },
    requestCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    requestActions: { flexDirection: "row", gap: 8 },
    acceptButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.successLight,
      justifyContent: "center",
      alignItems: "center",
    },
    acceptButtonText: {
      color: colors.success,
      fontSize: 20,
      fontWeight: "bold",
    },
    rejectButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.errorLight,
      justifyContent: "center",
      alignItems: "center",
    },
    rejectButtonText: { color: colors.error, fontSize: 20, fontWeight: "bold" },
    sentRequestCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statusBadge: {
      backgroundColor: colors.warningLight,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statusBadgeText: { color: "#92400e", fontSize: 12, fontWeight: "600" },
    statusBadgeFriend: { backgroundColor: colors.successLight },
    searchContainer: { position: "relative", marginBottom: 20 },
    searchInput: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      borderWidth: 2,
      borderColor: colors.infoLight,
    },
    searchLoader: { position: "absolute", right: 14, top: 14 },
    searchResultCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    searchResultActions: { flexDirection: "row", gap: 8 },
    addButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    addButtonText: { color: colors.surface, fontWeight: "600", fontSize: 13 },
    respondButton: {
      backgroundColor: colors.accentLight,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    respondButtonText: {
      color: colors.accent,
      fontWeight: "600",
      fontSize: 13,
    },
    emptyState: {
      alignItems: "center",
      padding: 40,
      backgroundColor: colors.surface,
      borderRadius: 12,
    },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: 20,
    },
    emptyButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    emptyButtonText: { color: colors.surface, fontWeight: "600", fontSize: 15 },
    emptyStateSmall: {
      alignItems: "center",
      padding: 24,
      backgroundColor: colors.surface,
      borderRadius: 12,
    },
    emptyTextSmall: { fontSize: 14, color: colors.textMuted },
    calendarHint: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 16,
    },
    calendarLoading: { paddingVertical: 40, alignItems: "center" },
    analyticsLoading: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 16,
    },
    analyticsLoadingText: { fontSize: 16, color: colors.textSecondary },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    backButton: { width: 80 },
    backButtonText: { fontSize: 16, color: colors.accent, fontWeight: "600" },
    modalHeaderTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    modalScroll: { flex: 1, backgroundColor: colors.background },
    friendDetailContent: { padding: 20, paddingBottom: 40 },
    workoutHistorySection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    sectionTitleLarge: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 16,
    },
    chevronRight: { fontSize: 28, color: colors.surfaceBorder },
    sessionListItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      backgroundColor: colors.surface,
      borderRadius: 8,
      marginBottom: 8,
    },
    sessionListLeft: { flex: 1 },
    sessionListTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    sessionListMeta: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    },
    sessionListTime: { fontSize: 13, color: colors.textSecondary },
    sessionListDuration: { fontSize: 13, color: colors.textSecondary },
    sessionListSets: { fontSize: 13, color: colors.textSecondary },
    sessionListArrow: {
      fontSize: 24,
      color: colors.surfaceBorder,
      marginLeft: 10,
    },
    sessionDetailsContent: { padding: 16, paddingBottom: 40 },
    detailSection: { marginBottom: 20 },
    detailTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    detailSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    muscleGroupsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginRight: -8,
      marginBottom: -8,
    },
    muscleTag: {
      backgroundColor: colors.accentLight,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 8,
      marginBottom: 8,
    },
    muscleTagText: { color: colors.accent, fontSize: 13, fontWeight: "500" },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    detailLabel: { fontSize: 15, color: colors.textSecondary },
    detailValue: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
    detailSectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    exerciseCard: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    exerciseHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.inputBorder,
    },
    exerciseName: {
      fontSize: 17,
      fontWeight: "bold",
      color: colors.textPrimary,
      flex: 1,
    },
    exerciseSetsCount: {
      fontSize: 14,
      color: colors.accent,
      fontWeight: "600",
    },
    setTimingCard: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    setTimingTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    setTimingDetail: { fontSize: 14, color: colors.textSecondary },
    friendTabContainer: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    friendTab: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 2,
      alignItems: "center",
      borderBottomWidth: 3,
      borderBottomColor: "transparent",
    },
    friendTabActive: { borderBottomColor: colors.accent },
    friendTabText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
      textAlign: "center",
    },
    friendTabTextActive: { color: colors.accent },
    actionsTabContent: { padding: 20, paddingBottom: 60 },
    actionsTabSectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: "#aaa",
      textTransform: "uppercase",
      letterSpacing: 0.9,
      marginBottom: 6,
    },
    actionsTabSectionHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 12,
      lineHeight: 17,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    actionRowDanger: {
      borderWidth: 1,
      borderColor: "#fecaca",
      backgroundColor: "#fff5f5",
    },
    actionRowIcon: { fontSize: 28, marginRight: 14 },
    actionRowText: { flex: 1 },
    actionRowTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    actionRowSub: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    actionRowArrow: {
      fontSize: 24,
      color: colors.surfaceBorder,
      marginLeft: 4,
    },
    programViewHeader: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    programViewTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    programViewMeta: {
      fontSize: 14,
      color: colors.accent,
      fontWeight: "600",
      marginBottom: 4,
    },
    programViewShared: { fontSize: 13, color: colors.textMuted },
    programDayCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    programDayHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      gap: 10,
    },
    programDayNumber: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
      backgroundColor: colors.infoLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    programDayTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
      flex: 1,
    },
    programExerciseRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.background,
    },
    programExerciseLeft: { flex: 1, marginRight: 12 },
    programExerciseName: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    programExerciseSets: { fontSize: 13, color: colors.textMuted },
    programSetsBadge: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.infoLight,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      minWidth: 44,
    },
    programSetsBadgeText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.accent,
      lineHeight: 18,
    },
    programSetsBadgeLabel: {
      fontSize: 10,
      color: colors.accent,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    programSetsRow: { flexDirection: "row", gap: 6 },
    peopleSelectorContainer: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      paddingVertical: 10,
    },
    peopleSelectorScroll: { paddingHorizontal: 16, gap: 8 },
    peoplePill: {
      paddingHorizontal: 18,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.separator,
      borderWidth: 2,
      borderColor: "transparent",
    },
    peoplePillActive: {
      backgroundColor: colors.infoLight,
      borderColor: colors.accent,
    },
    peoplePillText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    peoplePillTextActive: { color: colors.accent },
    activeSessionPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#ecfdf5",
      borderBottomWidth: 1,
      borderBottomColor: colors.success,
      paddingHorizontal: 20,
      paddingVertical: 10,
      gap: 8,
    },
    liveIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    activeSessionText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: colors.success,
    },
    leaveText: { fontSize: 13, fontWeight: "700", color: colors.error },
  })
