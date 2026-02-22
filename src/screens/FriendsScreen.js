import React, { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuth } from "../context/AuthContext"
import { friendsApi, sharingApi } from "../services/api"
import { useWorkout } from "../context/WorkoutContext"
import ModalSheet from "../components/ModalSheet"
import UniversalCalendar from "../components/UniversalCalendar"
import ExerciseAnalytics from "../components/ExerciseAnalytics"
import { useAlert } from "../components/CustomAlert"

export default function FriendsScreen() {
  const { user } = useAuth()
  const { workoutData } = useWorkout()
  const { alert, AlertComponent } = useAlert()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("friends")

  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [receivedAnalytics, setReceivedAnalytics] = useState([])
  const [sentAnalytics, setSentAnalytics] = useState([])
  const [receivedPrograms, setReceivedPrograms] = useState([])
  const [sentPrograms, setSentPrograms] = useState([])
  const [sharingStats, setSharingStats] = useState(null)

  const [showShareAnalyticsModal, setShowShareAnalyticsModal] = useState(false)
  const [showShareProgramModal, setShowShareProgramModal] = useState(false)
  const [showFriendDetailModal, setShowFriendDetailModal] = useState(false)
  const [activeFriendTab, setActiveFriendTab] = useState("history")
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [shareMessage, setShareMessage] = useState("")
  const [includeAllSessions, setIncludeAllSessions] = useState(true)

  const [friendSessionHistory, setFriendSessionHistory] = useState([])
  const [loadingFriendSessions, setLoadingFriendSessions] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [showSessionDetails, setShowSessionDetails] = useState(false)

  const [friendSessionsWithTimings, setFriendSessionsWithTimings] = useState([])
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedProgram, setSelectedProgram] = useState(null)

  const [sharingAnalytics, setSharingAnalytics] = useState(false)
  const [sharingProgram, setSharingProgram] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadData()
    }
  }, [user?.id])

  const hasFriendSharedAnalyticsWith = (friendId) => {
    if (!friendId) return false
    return receivedAnalytics.some((s) => s.senderId === friendId)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadFriends(), loadSharing()])
    } catch (error) {
      console.error("Error loading friends data:", error)
      alert("Error", "Failed to load friends data", [{ text: "OK" }], "error")
    } finally {
      setLoading(false)
    }
  }

  const loadFriends = async () => {
    try {
      const [friendsData, pendingData, sentData] = await Promise.all([
        friendsApi.getFriends(),
        friendsApi.getPendingRequests(),
        friendsApi.getSentRequests(),
      ])
      setFriends(friendsData || [])
      setPendingRequests(pendingData || [])
      setSentRequests(sentData || [])
    } catch (error) {
      console.error("Error loading friends:", error)
      throw error
    }
  }

  const loadSharing = async () => {
    try {
      const [receivedAn, sentAn, receivedProg, sentProg, stats] =
        await Promise.all([
          sharingApi.getReceivedAnalytics(),
          sharingApi.getSentAnalytics(),
          sharingApi.getReceivedPrograms(),
          sharingApi.getSentPrograms(),
          sharingApi.getSharingStats(),
        ])
      setReceivedAnalytics(receivedAn || [])
      setSentAnalytics(sentAn || [])
      setReceivedPrograms(receivedProg || [])
      setSentPrograms(sentProg || [])
      setSharingStats(stats || null)
    } catch (error) {
      console.error("Error loading sharing data:", error)
      throw error
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await loadData()
    } catch (error) {
      console.error("Refresh failed:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await friendsApi.searchUsers(searchQuery.trim(), 10)
      setSearchResults(results || [])
    } catch (error) {
      console.error("Error searching users:", error)
      alert("Error", "Failed to search users", [{ text: "OK" }], "error")
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch()
      } else {
        setSearchResults([])
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const sendFriendRequest = async (username) => {
    try {
      await friendsApi.sendFriendRequest(username)
      await loadFriends()
      setSearchQuery("")
      setSearchResults([])
    } catch (error) {
      console.error("Error sending friend request:", error)
      alert(
        "Error",
        error.message || "Failed to send friend request",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  const acceptFriendRequest = async (friendshipId, username) => {
    try {
      await friendsApi.acceptFriendRequest(friendshipId)
      await loadFriends()
    } catch (error) {
      console.error("Error accepting friend request:", error)
      alert(
        "Error",
        error.message || "Failed to accept friend request",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  const rejectFriendRequest = async (friendshipId, username) => {
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
              alert(
                "Request Rejected",
                `Rejected request from ${username}`,
                [{ text: "OK" }],
                "info",
              )
              await loadFriends()
            } catch (error) {
              console.error("Error rejecting friend request:", error)
              alert(
                "Error",
                error.message || "Failed to reject request",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "warning",
    )
  }

  const removeFriend = async (friendId, username) => {
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
              alert(
                "Friend Removed",
                `${username} has been removed`,
                [{ text: "OK" }],
                "info",
              )
              await loadFriends()
            } catch (error) {
              console.error("Error removing friend:", error)
              alert(
                "Error",
                error.message || "Failed to remove friend",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "warning",
    )
  }

  const shareAnalytics = async () => {
    if (!selectedFriend)
      return alert("Error", "Please select a friend", [{ text: "OK" }], "error")
    try {
      await sharingApi.shareAnalytics(
        selectedFriend.id,
        includeAllSessions,
        null,
        shareMessage.trim() || null,
      )
      alert(
        "Analytics Shared",
        `Your analytics have been shared with ${selectedFriend.username}`,
        [{ text: "OK" }],
        "success",
      )
      setShowShareAnalyticsModal(false)
      setShareMessage("")
      setIncludeAllSessions(true)
      await loadSharing()
    } catch (error) {
      console.error("Error sharing analytics:", error)
      alert(
        "Error",
        error.message || "Failed to share analytics",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  const loadFriendData = async (friend) => {
    setShowFriendDetailModal(true)
    setActiveFriendTab(
      hasFriendSharedAnalyticsWith(friend.id) ? "history" : "actions",
    )

    if (!hasFriendSharedAnalyticsWith(friend.id)) {
      setFriendSessionHistory([])
      setFriendSessionsWithTimings([])
      setLoadingFriendSessions(false)
      return
    }

    setLoadingFriendSessions(true)
    setFriendSessionsWithTimings([])
    try {
      const sessions = await sharingApi.getFriendSessions(friend.id, 60)
      setFriendSessionHistory(sessions || [])
    } catch (error) {
      console.error("Error loading friend sessions:", error)
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

  const loadFriendAnalytics = async (friend, sessions) => {
    if (!friend || !sessions.length) return
    setLoadingAnalytics(true)
    try {
      const detailed = await Promise.all(
        sessions.map((s) =>
          sharingApi.getFriendSessionDetails(friend.id, s.id).catch((err) => {
            console.warn(`Failed to load session ${s.id}:`, err)
            return { ...s, set_timings: [] }
          }),
        ),
      )
      const totalTimings = detailed.reduce(
        (n, s) => n + (s.set_timings?.length ?? 0),
        0,
      )
      console.log(
        `Analytics: ${detailed.length} sessions, ${totalTimings} total set_timings`,
      )
      setFriendSessionsWithTimings(detailed)
    } catch (error) {
      console.error("Error loading friend analytics:", error)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const hasAlreadySharedAnalyticsWith = (friendId) => {
    if (!friendId) return false
    return sentAnalytics.some((s) => s.receiverId === friendId)
  }

  const hasAlreadySharedProgramWith = (friendId) => {
    if (!friendId) return false
    return sentPrograms.some((s) => s.receiverId === friendId)
  }

  const shareAnalyticsToFriend = async (friend) => {
    if (!friend) return
    setSharingAnalytics(true)
    try {
      await sharingApi.shareAnalytics(friend.id, true, null, null)
      alert(
        "Analytics Shared",
        `Your analytics have been shared with ${friend.username}`,
        [{ text: "OK" }],
        "success",
      )
      await loadSharing()
    } catch (error) {
      console.error("Error sharing analytics:", error)
      alert(
        "Error",
        error.message || "Failed to share analytics",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setSharingAnalytics(false)
    }
  }

  const shareProgramToFriend = async (friend) => {
    if (!friend) return
    if (!workoutData)
      return alert(
        "Error",
        "No program loaded to share",
        [{ text: "OK" }],
        "error",
      )
    setSharingProgram(true)
    try {
      const programData = {
        name: `${workoutData.people?.join("/")} Program - ${workoutData.totalDays} Days`,
        totalDays: workoutData.totalDays,
        people: workoutData.people,
        days: workoutData.days,
      }
      await sharingApi.shareProgram(friend.id, programData, null)
      alert(
        "Program Shared",
        `Program shared with ${friend.username}`,
        [{ text: "OK" }],
        "success",
      )
      await loadSharing()
    } catch (error) {
      console.error("Error sharing program:", error)
      alert(
        "Error",
        error.message || "Failed to share program",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setSharingProgram(false)
    }
  }

  const toLocalDateStr = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  const getSessionsForDate = (date) => {
    const targetStr = toLocalDateStr(date)
    return friendSessionHistory.filter((session) => {
      const sessionDateStr = String(session.start_time)
        .replace("T", " ")
        .split(" ")[0]
      return sessionDateStr === targetStr
    })
  }

  const hasSessionOnDate = (date) => getSessionsForDate(date).length > 0

  const handleDatePress = (date) => {
    const sessionsOnDate = getSessionsForDate(date)
    if (sessionsOnDate.length === 1) {
      handleSessionPress(sessionsOnDate[0], selectedFriend)
    } else if (sessionsOnDate.length > 1) {
      setSelectedDate(date)
    }
  }

  const handleSessionPress = async (session, friend = selectedFriend) => {
    if (!friend) {
      alert(
        "Error",
        "Friend context lost. Please try again.",
        [{ text: "OK" }],
        "error",
      )
      return
    }
    try {
      const details = await sharingApi.getFriendSessionDetails(
        friend.id,
        session.id,
      )

      if (details.set_timings && details.set_timings.length > 0) {
        const exerciseMap = new Map()
        details.set_timings.forEach((timing) => {
          const key =
            timing.exercise_name || `Exercise ${timing.exercise_id ?? "?"}`
          if (!exerciseMap.has(key)) {
            exerciseMap.set(key, { exerciseName: key, sets: [] })
          }
          exerciseMap.get(key).sets.push(timing)
        })
        exerciseMap.forEach((exercise) => {
          exercise.sets.sort((a, b) => a.set_index - b.set_index)
        })
        details.groupedExercises = Array.from(exerciseMap.values())
      } else {
        details.groupedExercises = []
      }

      setSelectedSession(details)
      setSelectedDate(null)
      setShowSessionDetails(true)
    } catch (error) {
      console.error("Error loading session details:", error)
      alert(
        "Error",
        "Failed to load session details",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  const openShareProgramModal = (friend) => {
    setSelectedFriend(friend)
    setShowShareProgramModal(true)
  }

  const shareProgram = async () => {
    if (!selectedFriend)
      return alert("Error", "Please select a friend", [{ text: "OK" }], "error")
    if (!workoutData)
      return alert(
        "Error",
        "No program loaded to share",
        [{ text: "OK" }],
        "error",
      )

    try {
      const programData = {
        name: `${workoutData.people?.join("/")} Program - ${workoutData.totalDays} Days`,
        totalDays: workoutData.totalDays,
        people: workoutData.people,
        days: workoutData.days,
      }
      await sharingApi.shareProgram(
        selectedFriend.id,
        programData,
        shareMessage.trim() || null,
      )
      alert(
        "Program Shared",
        `Program shared with ${selectedFriend.username}`,
        [{ text: "OK" }],
        "success",
      )
      setShowShareProgramModal(false)
      setSelectedFriend(null)
      setShareMessage("")
      await loadSharing()
    } catch (error) {
      console.error("Error sharing program:", error)
      alert(
        "Error",
        error.message || "Failed to share program",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  const acceptProgram = async (shareId, programName) => {
    alert(
      "Accept Program",
      `Add "${programName}" to your programs?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              await sharingApi.acceptProgram(shareId)
              alert(
                "Success",
                `Program "${programName}" added to your library`,
                [{ text: "OK" }],
                "success",
              )
              await loadSharing()
            } catch (error) {
              console.error("Error accepting program:", error)
              alert(
                "Error",
                error.message || "Failed to accept program",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "info",
    )
  }

  const deleteShare = async (shareType, shareId, description) => {
    alert(
      "Delete Share",
      `Delete this ${shareType} share?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await sharingApi.deleteShare(shareType, shareId)
              alert(
                "Share Deleted",
                `${description} has been deleted`,
                [{ text: "OK" }],
                "info",
              )
              await loadSharing()
            } catch (error) {
              console.error("Error deleting share:", error)
              alert(
                "Error",
                error.message || "Failed to delete share",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "warning",
    )
  }

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })

  const formatCalendarDate = (date) =>
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })

  const formatSessionTime = (dateString) => {
    if (!dateString) return ""
    const timePart = String(dateString).replace("T", " ").split(" ")[1] || ""
    const [hourStr, minuteStr] = timePart.split(":")
    const hour = parseInt(hourStr)
    const minute = minuteStr || "00"
    const ampm = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12
    return `${hour12}:${minute} ${ampm}`
  }

  const formatTime = (seconds) => {
    if (!seconds) return "N/A"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    if (hours > 0) return `${hours}h ${minutes}m`
    if (seconds >= 60)
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`
    return `${seconds}s`
  }

  const getSessionTitle = (session) => {
    if (!session?.day_title) return `Day ${session?.day_number ?? ""}`
    const parts = session.day_title.split("—")
    return parts.length > 1 ? parts[1].trim() : session.day_title
  }

  const groupedReceivedAnalytics = receivedAnalytics.reduce((acc, share) => {
    const key = share.senderId
    if (!acc[key]) {
      acc[key] = {
        senderId: share.senderId,
        senderUsername: share.senderUsername,
        senderName: share.senderName,
        shares: [],
        latestShare: share.sharedAt,
      }
    }
    acc[key].shares.push(share)
    if (new Date(share.sharedAt) > new Date(acc[key].latestShare)) {
      acc[key].latestShare = share.sharedAt
    }
    return acc
  }, {})

  const groupedAnalyticsList = Object.values(groupedReceivedAnalytics).sort(
    (a, b) => new Date(b.latestShare) - new Date(a.latestShare),
  )

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
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#667eea"]}
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
                  {friends.map((friend) => (
                    <TouchableOpacity
                      key={friend.id}
                      style={styles.friendCard}
                      onPress={() => {
                        setSelectedFriend(friend)
                        loadFriendData(friend)
                      }}
                    >
                      <View style={styles.friendInfo}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {friend.username?.charAt(0).toUpperCase() || "?"}
                          </Text>
                        </View>
                        <View style={styles.friendDetails}>
                          <Text style={styles.friendName}>
                            {friend.username}
                          </Text>
                          <Text style={styles.friendMeta}>
                            Friends since {formatDate(friend.createdAt)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.friendActions}>
                        <Text style={styles.chevronRight}>›</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

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
                      <View key={request.id} style={styles.requestCard}>
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
                            onPress={() =>
                              acceptFriendRequest(
                                request.id,
                                request.senderUsername,
                              )
                            }
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
                      <View key={request.id} style={styles.sentRequestCard}>
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
                    const hasSentRequest = sentRequests.some(
                      (r) => r.receiverId === result.id,
                    )
                    const hasPendingRequest = pendingRequests.some(
                      (r) => r.senderId === result.id,
                    )

                    return (
                      <View key={result.id} style={styles.searchResultCard}>
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
                          {result.id === user.id ? (
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
                          ) : hasSentRequest ? (
                            <View style={styles.statusBadge}>
                              <Text style={styles.statusBadgeText}>
                                Pending
                              </Text>
                            </View>
                          ) : hasPendingRequest ? (
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

      {/* ── Share Program Modal ── */}
      <ModalSheet
        visible={showShareProgramModal}
        onClose={() => {
          setShowShareProgramModal(false)
          setSelectedFriend(null)
          setShareMessage("")
        }}
        title={`Share Program with ${selectedFriend?.username || ""}`}
        onConfirm={shareProgram}
        confirmText='Share'
      >
        {!workoutData ? (
          <View style={styles.emptyStateSmall}>
            <Text style={styles.emptyTextSmall}>
              No program loaded. Upload a workout file first.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.programPreview}>
              <Text style={styles.programPreviewTitle}>Current Program</Text>
              <Text style={styles.programPreviewText}>
                📋 {workoutData.people?.join("/")} Program
              </Text>
              <Text style={styles.programPreviewText}>
                📅 {workoutData.totalDays} Days
              </Text>
            </View>
            <Text style={styles.inputLabel}>Message (optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder='Add a message...'
              value={shareMessage}
              onChangeText={setShareMessage}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.modalHint}>
              Share your current workout program with your friend
            </Text>
          </>
        )}
      </ModalSheet>

      {/* ── Friend Detail Modal ── */}
      <ModalSheet
        visible={showFriendDetailModal}
        contentStyle={{ flex: 1 }}
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
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
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

          {/* ── Friend Tabs ── */}
          <View style={styles.friendTabContainer}>
            {(() => {
              const hasSharedWithMe = hasFriendSharedAnalyticsWith(
                selectedFriend?.id,
              )
              const programsFromFriend = receivedPrograms.filter(
                (p) => p.senderId === selectedFriend?.id,
              )
              const hasProgramFromFriend = programsFromFriend.length > 0

              const tabs = [
                {
                  key: "history",
                  label: "📅 History",
                  locked: !hasSharedWithMe,
                },
                {
                  key: "analytics",
                  label: "📊 Analytics",
                  locked: !hasSharedWithMe,
                },
                {
                  key: "program",
                  label: "📋 Program",
                  locked: !hasProgramFromFriend,
                },
                { key: "actions", label: "⚙️ Actions", locked: false },
              ]

              return tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.friendTab,
                    activeFriendTab === tab.key && styles.friendTabActive,
                    tab.locked && { opacity: 0.35 },
                  ]}
                  onPress={() => {
                    if (tab.locked) {
                      alert(
                        "Not Available",
                        tab.key === "program"
                          ? `${selectedFriend?.username} hasn't shared a program with you yet.`
                          : `${selectedFriend?.username} hasn't shared their workout data with you yet.`,
                        [{ text: "OK" }],
                        "lock",
                      )
                      return
                    }
                    setActiveFriendTab(tab.key)
                    if (
                      tab.key === "analytics" &&
                      friendSessionsWithTimings.length === 0 &&
                      !loadingAnalytics &&
                      friendSessionHistory.length > 0
                    ) {
                      loadFriendAnalytics(selectedFriend, friendSessionHistory)
                    }
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

          {/* ── History Tab ── */}
          {activeFriendTab === "history" &&
            (!hasFriendSharedAnalyticsWith(selectedFriend?.id) ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔒</Text>
                <Text style={styles.emptyTitle}>Not shared yet</Text>
                <Text style={styles.emptyText}>
                  {selectedFriend?.username} hasn't shared their workout history
                  with you.
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
                          showViewToggle={true}
                        />
                      </>
                    )}
                  </View>
                </View>
              </ScrollView>
            ))}

          {/* ── Analytics Tab ── */}
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
                  sessions={friendSessionsWithTimings}
                  containerPadding={20}
                  workoutData={null}
                  selectedPerson={null}
                  title={`📊 ${selectedFriend?.username}'s Analytics`}
                  isDemoMode={false}
                  completedDays={{}}
                  currentBodyWeight={null}
                />
              </View>
            ))}

          {/* ── Program Tab ── */}
          {activeFriendTab === "program" &&
            (() => {
              const programsFromFriend = receivedPrograms.filter(
                (p) => p.senderId === selectedFriend?.id,
              )
              if (programsFromFriend.length === 0) {
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
              }
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
                      pd.days.map((day, dayIdx) => {
                        const exercises = Array.isArray(day.exercises)
                          ? day.exercises.filter((ex) => {
                              if (!selectedProgram) return true
                              const count =
                                ex.setsByPerson?.[selectedProgram] ?? 0
                              return count > 0
                            })
                          : []

                        if (exercises.length === 0) return null

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
                              const personEntries = selectedProgram
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

          {/* ── Actions Tab ── */}
          {activeFriendTab === "actions" && (
            <ScrollView style={styles.modalScroll}>
              <View style={styles.actionsTabContent}>
                <Text style={styles.actionsTabSectionTitle}>
                  Share With {selectedFriend?.username}
                </Text>

                {hasAlreadySharedAnalyticsWith(selectedFriend?.id) ? (
                  <View style={styles.actionRow}>
                    <Text style={styles.actionRowIcon}>📊</Text>
                    <View style={styles.actionRowText}>
                      <Text style={styles.actionRowTitle}>
                        Analytics Shared
                      </Text>
                      <Text style={styles.actionRowSub}>
                        Already shared your analytics with{" "}
                        {selectedFriend?.username}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteShareButton}
                      onPress={() => {
                        const share = sentAnalytics.find(
                          (s) => s.receiverId === selectedFriend?.id,
                        )
                        if (share)
                          deleteShare("analytics", share.id, "Analytics share")
                      }}
                    >
                      <Text style={styles.deleteShareButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.actionRow,
                      sharingAnalytics && styles.actionRowDisabled,
                    ]}
                    onPress={() => shareAnalyticsToFriend(selectedFriend)}
                    disabled={sharingAnalytics}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionRowIcon}>📊</Text>
                    <View style={styles.actionRowText}>
                      <Text style={styles.actionRowTitle}>
                        Share My Analytics
                      </Text>
                      <Text style={styles.actionRowSub}>
                        Share your full workout analytics & progress
                      </Text>
                    </View>
                    {sharingAnalytics ? (
                      <ActivityIndicator size='small' color='#667eea' />
                    ) : (
                      <Text style={styles.actionRowArrow}>›</Text>
                    )}
                  </TouchableOpacity>
                )}

                {hasAlreadySharedProgramWith(selectedFriend?.id) ? (
                  <View style={styles.actionRow}>
                    <Text style={styles.actionRowIcon}>📋</Text>
                    <View style={styles.actionRowText}>
                      <Text style={styles.actionRowTitle}>Program Shared</Text>
                      <Text style={styles.actionRowSub}>
                        Already shared your program with{" "}
                        {selectedFriend?.username}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteShareButton}
                      onPress={() => {
                        const share = sentPrograms.find(
                          (s) => s.receiverId === selectedFriend?.id,
                        )
                        if (share)
                          deleteShare("program", share.id, "Program share")
                      }}
                    >
                      <Text style={styles.deleteShareButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.actionRow,
                      (!workoutData || sharingProgram) &&
                        styles.actionRowDisabled,
                    ]}
                    onPress={() => shareProgramToFriend(selectedFriend)}
                    disabled={sharingProgram || !workoutData}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionRowIcon}>📋</Text>
                    <View style={styles.actionRowText}>
                      <Text style={styles.actionRowTitle}>
                        Share My Program
                      </Text>
                      <Text style={styles.actionRowSub}>
                        {workoutData
                          ? `${workoutData.people?.join("/")} — ${workoutData.totalDays} days`
                          : "No program loaded"}
                      </Text>
                    </View>
                    {sharingProgram ? (
                      <ActivityIndicator size='small' color='#667eea' />
                    ) : (
                      <Text
                        style={[
                          styles.actionRowArrow,
                          !workoutData && { color: "#ddd" },
                        ]}
                      >
                        ›
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                <Text
                  style={[styles.actionsTabSectionTitle, { marginTop: 28 }]}
                >
                  Danger Zone
                </Text>

                <TouchableOpacity
                  style={[styles.actionRow, styles.actionRowDanger]}
                  onPress={() => {
                    setShowFriendDetailModal(false)
                    setSelectedFriend(null)
                    setFriendSessionHistory([])
                    setFriendSessionsWithTimings([])
                    removeFriend(selectedFriend?.id, selectedFriend?.username)
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionRowIcon}>🚫</Text>
                  <View style={styles.actionRowText}>
                    <Text style={[styles.actionRowTitle, { color: "#ef4444" }]}>
                      Remove Friend
                    </Text>
                    <Text style={styles.actionRowSub}>
                      Remove {selectedFriend?.username} from your friends list
                    </Text>
                  </View>
                  <Text style={[styles.actionRowArrow, { color: "#ef4444" }]}>
                    ›
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </ModalSheet>

      {/* ── Date Session Picker Modal ── */}
      <ModalSheet
        visible={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatCalendarDate(selectedDate) : ""}
        showCancelButton={false}
        showConfirmButton={false}
        scrollable={true}
      >
        {selectedDate &&
          getSessionsForDate(selectedDate).map((session) => (
            <TouchableOpacity
              key={session.id}
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

      {/* ── Session Details Modal ── */}
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
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
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
                          {selectedSession.muscle_groups.map((group, idx) => (
                            <View key={idx} style={styles.muscleTag}>
                              <Text style={styles.muscleTagText}>
                                {String(group)}
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
                          selectedSession.start_time,
                        ).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Start Time</Text>
                      <Text style={styles.detailValue}>
                        {formatSessionTime(selectedSession.start_time)}
                      </Text>
                    </View>
                    {!!selectedSession.end_time && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>End Time</Text>
                        <Text style={styles.detailValue}>
                          {formatSessionTime(selectedSession.end_time)}
                        </Text>
                      </View>
                    )}
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
                          (exercise, exerciseIdx) => (
                            <View key={exerciseIdx} style={styles.exerciseCard}>
                              <View style={styles.exerciseHeader}>
                                <Text style={styles.exerciseName}>
                                  {exercise.exerciseName}
                                </Text>
                                <Text style={styles.exerciseSetsCount}>
                                  {exercise.sets.length} sets
                                </Text>
                              </View>

                              {exercise.sets.map((set, setIdx) => (
                                <View key={setIdx} style={styles.setTimingCard}>
                                  <View style={styles.setTimingHeader}>
                                    <Text style={styles.setTimingTitle}>
                                      Set {set.set_index + 1}
                                    </Text>
                                  </View>
                                  <View style={styles.setTimingDetails}>
                                    <Text style={styles.setTimingDetail}>
                                      {(() => {
                                        const w = parseFloat(set.weight ?? 0)
                                        const r = parseInt(set.reps ?? 0)
                                        const volume = w * r
                                        const displayVolume = Number.isInteger(
                                          volume,
                                        )
                                          ? `${volume}`
                                          : `${volume.toFixed(1)}`
                                        return `${w}kg × ${r} = ${displayVolume}kg`
                                      })()}
                                    </Text>
                                    {!!set.set_duration && (
                                      <Text style={styles.setTimingDetail}>
                                        Duration:{" "}
                                        {set.set_duration >= 60
                                          ? `${Math.floor(set.set_duration / 60)}m${set.set_duration % 60 > 0 ? ` ${set.set_duration % 60}s` : ""}`
                                          : `${set.set_duration}s`}
                                      </Text>
                                    )}
                                  </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 120 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 16 },
  header: { marginBottom: 25, alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: "#333", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666", textAlign: "center" },
  tabContainer: { marginBottom: 20 },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  tabActive: { backgroundColor: "#667eea" },
  tabIcon: { fontSize: 20, marginRight: 8 },
  tabLabel: { fontSize: 14, fontWeight: "600", color: "#666" },
  tabLabelActive: { color: "#fff" },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  section: { marginBottom: 25 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  subsection: { marginBottom: 20 },
  subsectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  listContainer: { gap: 12 },
  friendCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  friendInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  friendDetails: { flex: 1 },
  friendName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  friendMeta: { fontSize: 13, color: "#999" },
  friendActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  requestCard: {
    backgroundColor: "#fff",
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
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButtonText: { color: "#10b981", fontSize: 20, fontWeight: "bold" },
  rejectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
  },
  rejectButtonText: { color: "#ef4444", fontSize: 20, fontWeight: "bold" },
  sentRequestCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: { color: "#92400e", fontSize: 12, fontWeight: "600" },
  statusBadgeFriend: { backgroundColor: "#dcfce7" },
  searchContainer: { position: "relative", marginBottom: 20 },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 2,
    borderColor: "#e0e7ff",
  },
  searchLoader: { position: "absolute", right: 14, top: 14 },
  searchResultCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchResultActions: { flexDirection: "row", gap: 8 },
  addButton: {
    backgroundColor: "#667eea",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  respondButton: {
    backgroundColor: "#f0f3ff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  respondButtonText: { color: "#667eea", fontWeight: "600", fontSize: 13 },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#999",
    textAlign: "center",
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: "#667eea",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  emptyStateSmall: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  emptyTextSmall: { fontSize: 14, color: "#999" },
  inputLabel: { fontSize: 13, color: "#555", marginBottom: 6, marginTop: 8 },
  textArea: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minHeight: 80,
    textAlignVertical: "top",
  },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#667eea",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxCheck: { color: "#667eea", fontSize: 16, fontWeight: "bold" },
  checkboxLabel: { fontSize: 15, color: "#333" },
  modalHint: { fontSize: 13, color: "#999", textAlign: "center", marginTop: 8 },
  programPreview: {
    backgroundColor: "#f0f3ff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  programPreviewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#667eea",
    marginBottom: 8,
  },
  programPreviewText: { fontSize: 14, color: "#333", marginBottom: 4 },
  calendarHint: {
    fontSize: 14,
    color: "#666",
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
  analyticsLoadingText: { fontSize: 16, color: "#666" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: { width: 80 },
  backButtonText: { fontSize: 16, color: "#667eea", fontWeight: "600" },
  modalHeaderTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  modalScroll: { flex: 1, backgroundColor: "#f5f5f5" },
  friendDetailContent: { padding: 20, paddingBottom: 40 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  actionButtonDanger: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  actionButtonIcon: { fontSize: 24, marginRight: 12 },
  actionButtonText: { fontSize: 16, fontWeight: "600", color: "#333" },
  actionButtonTextDanger: { color: "#ef4444" },
  workoutHistorySection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  sectionTitleLarge: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  chevronRight: { fontSize: 28, color: "#ccc" },
  sessionListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionListLeft: { flex: 1 },
  sessionListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  sessionListMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  sessionListTime: { fontSize: 13, color: "#666" },
  sessionListDuration: { fontSize: 13, color: "#666" },
  sessionListSets: { fontSize: 13, color: "#666" },
  sessionListArrow: { fontSize: 24, color: "#ccc", marginLeft: 10 },
  sessionDetailsContent: { padding: 16, paddingBottom: 40 },
  detailSection: { marginBottom: 20 },
  detailTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  detailSubtitle: { fontSize: 16, color: "#666", marginBottom: 12 },
  muscleGroupsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginRight: -8,
    marginBottom: -8,
  },
  muscleTag: {
    backgroundColor: "#f0f3ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  muscleTagText: { color: "#667eea", fontSize: 13, fontWeight: "500" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailLabel: { fontSize: 15, color: "#666" },
  detailValue: { fontSize: 15, fontWeight: "600", color: "#333" },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  exerciseName: { fontSize: 17, fontWeight: "bold", color: "#333", flex: 1 },
  exerciseSetsCount: { fontSize: 14, color: "#667eea", fontWeight: "600" },
  setTimingCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  setTimingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  setTimingTitle: { fontSize: 15, fontWeight: "600", color: "#333" },
  setTimingDetails: { flexDirection: "row", justifyContent: "space-between" },
  setTimingDetail: { fontSize: 14, color: "#666" },
  friendTabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  friendTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 2,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  friendTabActive: { borderBottomColor: "#667eea" },
  friendTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
    textAlign: "center",
  },
  friendTabTextActive: { color: "#667eea" },
  actionsTabContent: { padding: 20, paddingBottom: 60 },
  actionsTabSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  actionRowDisabled: { opacity: 0.5 },
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
    color: "#222",
    marginBottom: 2,
  },
  actionRowSub: { fontSize: 13, color: "#888", lineHeight: 18 },
  actionRowArrow: { fontSize: 24, color: "#ccc", marginLeft: 4 },
  deleteShareButton: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 8,
  },
  deleteShareButtonText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },
  programViewHeader: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  programViewTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  programViewMeta: {
    fontSize: 14,
    color: "#667eea",
    fontWeight: "600",
    marginBottom: 4,
  },
  programViewShared: { fontSize: 13, color: "#999" },
  programDayCard: {
    backgroundColor: "#fff",
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
    borderBottomColor: "#f0f0f0",
    gap: 10,
  },
  programDayNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#667eea",
    backgroundColor: "#e0e7ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  programDayTitle: { fontSize: 15, fontWeight: "600", color: "#333", flex: 1 },
  programExerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  programExerciseLeft: { flex: 1, marginRight: 12 },
  programExerciseName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#222",
    marginBottom: 2,
  },
  programExerciseSets: { fontSize: 13, color: "#888" },
  programSetsBadge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0e7ff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 44,
  },
  programSetsBadgeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#667eea",
    lineHeight: 18,
  },
  programSetsBadgeLabel: {
    fontSize: 10,
    color: "#667eea",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  programNoExercises: {
    fontSize: 13,
    color: "#bbb",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  programSetsRow: { flexDirection: "row", gap: 6 },
  peopleSelectorContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingVertical: 10,
  },
  peopleSelectorScroll: { paddingHorizontal: 16, gap: 8 },
  peoplePill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    borderWidth: 2,
    borderColor: "transparent",
  },
  peoplePillActive: { backgroundColor: "#e0e7ff", borderColor: "#667eea" },
  peoplePillText: { fontSize: 14, fontWeight: "600", color: "#888" },
  peoplePillTextActive: { color: "#667eea" },
})
