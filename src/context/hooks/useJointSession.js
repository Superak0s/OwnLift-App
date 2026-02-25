// hooks/useJointSession.js
//
// COMPLETE FILE - Replace everything with this

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { sharingApi } from "../../services/api"

const SYNC_PULSE_MS = 1_500

export const useJointSession = ({
  userId,
  currentSessionId,
  workoutStartTime,
  currentDayExercises = [],
  selectedPerson = null,
  socket,
}) => {
  const [jointSession, setJointSession] = useState(null)
  const [partnerProgress, setPartnerProgress] = useState(null)
  const [myProgress, setMyProgress] = useState(null)
  const [pendingInvite, setPendingInvite] = useState(null)
  const [inviteStatus, setInviteStatus] = useState("idle")
  const [isPartnerReady, setIsPartnerReady] = useState(false)
  const [syncPulse, setSyncPulse] = useState(false)
  const [partnerCompletedSets, setPartnerCompletedSets] = useState([])

  const [watchTarget, setWatchTarget] = useState(null)
  const [watchSession, setWatchSession] = useState(null)
  const [watchLoading, setWatchLoading] = useState(false)
  const [watchError, setWatchError] = useState(null)

  const syncPulseTimer = useRef(null)
  const jointSessionIdRef = useRef(null)
  const watchTargetRef = useRef(null)
  const lastPushedKeyRef = useRef(null)

  const isInJointSession = inviteStatus === "active" && !!jointSession
  const isWatching = !!watchTarget
  const jointSessionId = jointSession?.id ?? null

  useEffect(() => {
    jointSessionIdRef.current = jointSessionId
  }, [jointSessionId])
  useEffect(() => {
    watchTargetRef.current = watchTarget
  }, [watchTarget])

  const myExerciseNamesKey = useMemo(() => {
    return currentDayExercises
      .filter((e) => e.person === selectedPerson)
      .map((e) => e.name)
      .filter(Boolean)
      .join("||")
  }, [currentDayExercises, selectedPerson])

  const partnerExerciseList = useMemo(() => {
    if (!isInJointSession || !currentDayExercises.length) return []
    const otherPersonExercises = currentDayExercises.filter(
      (e) => e.person && e.person !== selectedPerson,
    )
    const source =
      otherPersonExercises.length > 0
        ? otherPersonExercises
        : currentDayExercises
    const seen = new Set()
    const result = []
    for (const e of source) {
      const key = (e.name ?? "").trim().toLowerCase()
      if (key && !seen.has(key)) {
        seen.add(key)
        result.push({ name: e.name, sets: e.sets })
      }
    }
    return result
  }, [isInJointSession, currentDayExercises, selectedPerson])

  const triggerSyncPulse = useCallback(() => {
    setSyncPulse(true)
    if (syncPulseTimer.current) clearTimeout(syncPulseTimer.current)
    syncPulseTimer.current = setTimeout(
      () => setSyncPulse(false),
      SYNC_PULSE_MS,
    )
  }, [])

  // ★★★ CRITICAL: This is the ONLY place the fix should be ★★★
  const handleSocketMessage = useCallback(
    (msg) => {
      console.log("[WS_MESSAGE]", msg.type, msg)

      switch (msg.type) {
        case "joint_progress": {
          console.log("[JOINT_PROGRESS_RECEIVED]", {
            progress: msg.progress,
            currentExerciseIndex: msg.progress?.exerciseIndex,
            currentSetIndex: msg.progress?.setIndex,
            exerciseName: msg.progress?.exerciseName,
            exerciseNames: msg.progress?.exerciseNames,
            fromUserId: msg.progress.fromUserId,
          })

          const { progress } = msg
          if (!progress) break

          // ★★★ THE FIX: Update jointSession.participants with exerciseNames ★★★
          if (progress.exerciseNames && progress.fromUserId) {
            console.log("[UPDATING_PARTICIPANT_EXERCISES]", {
              userId: msg.progress.fromUserId,
              exercisesCount: progress.exerciseNames.length,
              exerciseNames: progress.exerciseNames,
            })

            setJointSession((prevSession) => {
              if (!prevSession) {
                console.log("[UPDATE_SKIPPED] No previous session")
                return prevSession
              }

              if (
                !prevSession.participants ||
                prevSession.participants.length === 0
              ) {
                console.log("[UPDATE_SKIPPED] No participants")
                return prevSession
              }

              const updated = { ...prevSession }
              updated.participants = prevSession.participants.map((p) => {
                if (p.userId === msg.progress.fromUserId) {
                  console.log("[PARTICIPANT_UPDATED]", {
                    username: p.username,
                    userId: p.userId,
                    hadExercises: !!p.exerciseNames,
                    nowHasExercises: !!progress.exerciseNames,
                    exercisesCount: progress.exerciseNames.length,
                  })
                  return {
                    ...p,
                    exerciseNames: progress.exerciseNames,
                  }
                }
                return p
              })

              console.log("[SESSION_UPDATED_WITH_EXERCISES]", {
                participants: updated.participants.map((p) => ({
                  userId: p.userId,
                  username: p.username,
                  exerciseNamesCount: p.exerciseNames?.length ?? 0,
                })),
              })

              return updated
            })
          } else {
            console.log("[NO_UPDATE_NEEDED]", {
              hasExerciseNames: !!progress.exerciseNames,
              fromUserId: msg.progress.fromUserId,
            })
          }

          setPartnerProgress((prev) => {
            const changed =
              prev?.exerciseIndex !== progress.exerciseIndex ||
              prev?.setIndex !== progress.setIndex

            console.log("[PARTNER_PROGRESS_UPDATE]", {
              changed,
              oldProgress: prev,
              newProgress: progress,
            })

            if (changed && progress.readyForNext) {
              console.log("[SYNC_PULSE_TRIGGERED]")
              triggerSyncPulse()
            }

            if (
              changed &&
              progress.exerciseName != null &&
              progress.setIndex != null
            ) {
              console.log("[ADDING_TO_COMPLETED_SETS]", {
                exerciseName: progress.exerciseName,
                setIndex: progress.setIndex,
              })

              setPartnerCompletedSets((prevSets) => {
                const exists = prevSets.some(
                  (s) =>
                    s.exerciseName?.trim().toLowerCase() ===
                      progress.exerciseName?.trim().toLowerCase() &&
                    s.setIndex === progress.setIndex,
                )

                console.log("[COMPLETED_SETS_CHECK]", {
                  exerciseName: progress.exerciseName,
                  setIndex: progress.setIndex,
                  alreadyExists: exists,
                  currentCompletedSets: prevSets,
                })

                if (exists) return prevSets

                const newSets = [
                  ...prevSets,
                  {
                    exerciseName: progress.exerciseName,
                    setIndex: progress.setIndex,
                  },
                ]

                console.log("[COMPLETED_SETS_UPDATED]", newSets)
                return newSets
              })
            }

            return {
              exerciseIndex: progress.exerciseIndex ?? null,
              setIndex: progress.setIndex ?? null,
              exerciseName: progress.exerciseName ?? null,
              readyForNext: progress.readyForNext ?? false,
              lastUpdated: Date.now(),
            }
          })

          setIsPartnerReady(progress.readyForNext ?? false)
          break
        }

        case "joint_invite": {
          console.log("[JOINT_INVITE_RECEIVED]", msg)
          if (!isInJointSession) setPendingInvite(msg)
          break
        }

        case "invite_status": {
          console.log("[INVITE_STATUS]", msg.status, msg.jointSession)
          if (msg.status === "accepted" && msg.jointSession) {
            setInviteStatus("active")
            setJointSession(msg.jointSession)
            console.log("[JOINT_SESSION_ACTIVE]", msg.jointSession)
            jointSessionIdRef.current = msg.jointSession.id
          } else if (msg.status === "declined") {
            setInviteStatus("declined")
          } else if (msg.status === "session_ended") {
            console.log("[JOINT_SESSION_ENDED]")
            setJointSession(null)
            setPartnerProgress(null)
            setInviteStatus("idle")
            setIsPartnerReady(false)
            setMyProgress(null)
            setPartnerCompletedSets([])
          }
          break
        }

        case "joint_session_ended": {
          console.log("[PARTNER_LEFT_SESSION]")
          setJointSession(null)
          setPartnerProgress(null)
          setInviteStatus("idle")
          setIsPartnerReady(false)
          setMyProgress(null)
          setPartnerCompletedSets([])
          break
        }

        default:
          break
      }
    },
    [isInJointSession, triggerSyncPulse],
  )

  const sendInvite = useCallback(
    async (toUserId) => {
      if (!currentSessionId) return false
      setInviteStatus("sending")
      try {
        const res = await sharingApi.sendJointInvite({
          toUserId,
          fromSessionId: currentSessionId,
        })
        if (!res?.inviteId) {
          setInviteStatus("error")
          return false
        }
        setInviteStatus("waiting")
        return true
      } catch (err) {
        console.error("Failed to send joint invite:", err)
        setInviteStatus("error")
        return false
      }
    },
    [currentSessionId],
  )

  const acceptInvite = useCallback(async () => {
    if (!pendingInvite) return false
    try {
      const res = await sharingApi.acceptJointInvite(pendingInvite.inviteId)
      if (!res?.jointSession) return false
      setPendingInvite(null)
      setInviteStatus("active")
      setJointSession(res.jointSession)
      jointSessionIdRef.current = res.jointSession.id
      return true
    } catch (err) {
      console.error("Failed to accept joint invite:", err)
      return false
    }
  }, [pendingInvite])

  const declineInvite = useCallback(async () => {
    if (!pendingInvite) return
    try {
      await sharingApi.declineJointInvite(pendingInvite.inviteId)
    } catch (_) {}
    setPendingInvite(null)
  }, [pendingInvite])

  const leaveJointSession = useCallback(async () => {
    const id = jointSessionIdRef.current
    if (id) {
      socket?.send({ type: "leave_joint_session", jointSessionId: id })
      try {
        await sharingApi.leaveJointSession(id)
      } catch (_) {}
    }
    setJointSession(null)
    setPartnerProgress(null)
    setInviteStatus("idle")
    setIsPartnerReady(false)
    setMyProgress(null)
    setPartnerCompletedSets([])
  }, [socket])

  const pushProgress = useCallback(
    async ({ exerciseIndex, setIndex, exerciseName, readyForNext = false }) => {
      const id = jointSessionIdRef.current
      if (!id) return

      const exerciseNames = currentDayExercises
        .filter((e) => e.person === selectedPerson)
        .map((e) => ({ name: e.name, sets: e.sets }))
        .filter((e) => e.name)

      const progress = {
        exerciseIndex,
        setIndex,
        exerciseName,
        readyForNext,
        exerciseNames,
      }
      setMyProgress(progress)

      if (socket?.connected) {
        socket.send({
          type: "push_joint_progress",
          jointSessionId: id,
          progress,
        })
      } else {
        try {
          await sharingApi.pushJointProgress(id, progress)
        } catch (err) {
          console.warn("Failed to push joint progress:", err.message)
        }
      }
    },
    [socket, selectedPerson, currentDayExercises],
  )

  useEffect(() => {
    if (!isInJointSession || !myExerciseNamesKey) return
    if (lastPushedKeyRef.current === myExerciseNamesKey) return
    lastPushedKeyRef.current = myExerciseNamesKey

    const id = jointSessionIdRef.current
    if (!id) return

    const exerciseNames = currentDayExercises
      .filter((e) => e.person === selectedPerson)
      .map((e) => ({ name: e.name, sets: e.sets }))
      .filter((e) => e.name)

    const progress = {
      exerciseIndex: null,
      setIndex: null,
      exerciseName: null,
      readyForNext: false,
      exerciseNames,
    }

    if (socket?.connected) {
      socket.send({ type: "push_joint_progress", jointSessionId: id, progress })
    } else {
      sharingApi.pushJointProgress(id, progress).catch(() => {})
    }
  }, [isInJointSession, myExerciseNamesKey])

  useEffect(() => {
    if (!isInJointSession) lastPushedKeyRef.current = null
  }, [isInJointSession])

  const startWatching = useCallback(
    async (friendId, friendUsername, sessionId) => {
      setWatchTarget({ friendId, friendUsername, sessionId })
      setWatchSession(null)
      setWatchError(null)
      setWatchLoading(true)
      try {
        const live = await sharingApi.getFriendLiveSession(friendId, sessionId)
        if (!live) {
          setWatchError("session_ended")
          setWatchTarget(null)
          setWatchLoading(false)
          return false
        }
        setWatchSession(live)
        setWatchLoading(false)
        return true
      } catch (err) {
        console.error("Failed to start watching:", err.message)
        setWatchError("poll_error")
        setWatchTarget(null)
        setWatchLoading(false)
        return false
      }
    },
    [],
  )

  const stopWatching = useCallback(() => {
    setWatchTarget(null)
    setWatchSession(null)
    setWatchError(null)
    setWatchLoading(false)
  }, [])

  useEffect(() => {
    if (!workoutStartTime && isInJointSession) leaveJointSession()
  }, [workoutStartTime, isInJointSession, leaveJointSession])

  useEffect(() => {
    return () => {
      if (syncPulseTimer.current) clearTimeout(syncPulseTimer.current)
    }
  }, [])

  return {
    isInJointSession,
    jointSession,
    partnerProgress,
    myProgress,
    pendingInvite,
    inviteStatus,
    isPartnerReady,
    syncPulse,
    partnerExerciseList,
    sendInvite,
    acceptInvite,
    declineInvite,
    leaveJointSession,
    pushProgress,
    partnerCompletedSets,
    isWatching,
    watchTarget,
    watchSession,
    watchLoading,
    watchError,
    startWatching,
    stopWatching,
    handleSocketMessage,
  }
}
