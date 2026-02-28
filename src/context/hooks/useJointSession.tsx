// hooks/useJointSession.ts

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { sharingApi } from '../../services/api'
import type { RealtimeSocket, WebSocketMessage } from './useRealtimeSocket'

const SYNC_PULSE_MS = 1_500

export interface ExerciseEntry {
  name: string
  sets: number
  person?: string
}

export interface JointSessionParticipant {
  userId: string
  username: string
  exerciseNames?: Array<{ name: string; sets: number }>
}

export interface JointSession {
  id: string
  participants: JointSessionParticipant[]
}

export interface PartnerProgress {
  exerciseIndex: number | null
  setIndex: number | null
  exerciseName: string | null
  readyForNext: boolean
  lastUpdated: number
}

export interface PartnerCompletedSet {
  exerciseName: string
  setIndex: number
}

export interface WatchTarget {
  friendId: string
  friendUsername: string
  sessionId: string
}

export interface UseJointSessionOptions {
  userId: string | null
  currentSessionId: string | null
  workoutStartTime: string | null
  currentDayExercises?: ExerciseEntry[]
  selectedPerson?: string | null
  socket: RealtimeSocket | null
}

export interface UseJointSessionReturn {
  isInJointSession: boolean
  jointSession: JointSession | null
  partnerProgress: PartnerProgress | null
  myProgress: Record<string, unknown> | null
  pendingInvite: WebSocketMessage | null
  inviteStatus: string
  isPartnerReady: boolean
  syncPulse: boolean
  partnerExerciseList: Array<{ name: string; sets: number }>
  sendInvite: (toUserId: string) => Promise<boolean>
  acceptInvite: () => Promise<boolean>
  declineInvite: () => Promise<void>
  leaveJointSession: () => Promise<void>
  pushProgress: (args: {
    exerciseIndex: number | null
    setIndex: number | null
    exerciseName: string | null
    readyForNext?: boolean
  }) => Promise<void>
  partnerCompletedSets: PartnerCompletedSet[]
  isWatching: boolean
  watchTarget: WatchTarget | null
  watchSession: unknown
  watchLoading: boolean
  watchError: string | null
  startWatching: (friendId: string, friendUsername: string, sessionId: string) => Promise<boolean>
  stopWatching: () => void
  handleSocketMessage: (msg: WebSocketMessage) => void
}

// Typed shapes for specific WS message payloads
interface JointProgressPayload {
  exerciseIndex?: number | null
  setIndex?: number | null
  exerciseName?: string | null
  readyForNext?: boolean
  exerciseNames?: Array<{ name: string; sets: number }>
  fromUserId?: string
}

interface InviteStatusMessage extends WebSocketMessage {
  status: string
  jointSession?: JointSession
}

interface AcceptInviteResponse {
  jointSession?: JointSession
  inviteId?: string
}

export const useJointSession = ({
  userId,
  currentSessionId,
  workoutStartTime,
  currentDayExercises = [],
  selectedPerson = null,
  socket,
}: UseJointSessionOptions): UseJointSessionReturn => {
  const [jointSession, setJointSession] = useState<JointSession | null>(null)
  const [partnerProgress, setPartnerProgress] = useState<PartnerProgress | null>(null)
  const [myProgress, setMyProgress] = useState<Record<string, unknown> | null>(null)
  const [pendingInvite, setPendingInvite] = useState<WebSocketMessage | null>(null)
  const [inviteStatus, setInviteStatus] = useState<string>('idle')
  const [isPartnerReady, setIsPartnerReady] = useState(false)
  const [syncPulse, setSyncPulse] = useState(false)
  const [partnerCompletedSets, setPartnerCompletedSets] = useState<PartnerCompletedSet[]>([])

  const [watchTarget, setWatchTarget] = useState<WatchTarget | null>(null)
  const [watchSession, setWatchSession] = useState<unknown>(null)
  const [watchLoading, setWatchLoading] = useState(false)
  const [watchError, setWatchError] = useState<string | null>(null)

  const syncPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jointSessionIdRef = useRef<string | null>(null)
  const watchTargetRef = useRef<WatchTarget | null>(null)
  const lastPushedKeyRef = useRef<string | null>(null)

  const isInJointSession = inviteStatus === 'active' && !!jointSession
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
      .join('||')
  }, [currentDayExercises, selectedPerson])

  const partnerExerciseList = useMemo(() => {
    if (!isInJointSession || !currentDayExercises.length) return []
    const otherPersonExercises = currentDayExercises.filter(
      (e) => e.person && e.person !== selectedPerson,
    )
    const source = otherPersonExercises.length > 0 ? otherPersonExercises : currentDayExercises
    const seen = new Set<string>()
    const result: Array<{ name: string; sets: number }> = []
    for (const e of source) {
      const key = (e.name ?? '').trim().toLowerCase()
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
    syncPulseTimer.current = setTimeout(() => setSyncPulse(false), SYNC_PULSE_MS)
  }, [])

  const handleSocketMessage = useCallback(
    (msg: WebSocketMessage) => {
      console.log('[WS_MESSAGE]', msg.type, msg)

      switch (msg.type) {
        case 'joint_progress': {
          const progress = (msg as WebSocketMessage & { progress?: JointProgressPayload }).progress
          if (!progress) break

          if (progress.exerciseNames && progress.fromUserId) {
            setJointSession((prevSession) => {
              if (!prevSession?.participants?.length) return prevSession
              return {
                ...prevSession,
                participants: prevSession.participants.map((p) =>
                  p.userId === progress.fromUserId
                    ? { ...p, exerciseNames: progress.exerciseNames }
                    : p,
                ),
              }
            })
          }

          setPartnerProgress((prev) => {
            const changed =
              prev?.exerciseIndex !== progress.exerciseIndex ||
              prev?.setIndex !== progress.setIndex

            if (changed && progress.readyForNext) {
              triggerSyncPulse()
            }

            if (changed && progress.exerciseName != null && progress.setIndex != null) {
              setPartnerCompletedSets((prevSets) => {
                const exists = prevSets.some(
                  (s) =>
                    s.exerciseName?.trim().toLowerCase() ===
                      progress.exerciseName?.trim().toLowerCase() &&
                    s.setIndex === progress.setIndex,
                )
                if (exists) return prevSets
                return [
                  ...prevSets,
                  {
                    exerciseName: progress.exerciseName!,
                    setIndex: progress.setIndex!,
                  },
                ]
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

        case 'joint_invite': {
          if (!isInJointSession) setPendingInvite(msg)
          break
        }

        case 'invite_status': {
          // Cast through unknown first to safely narrow to our expected shape
          const statusMsg = msg as unknown as InviteStatusMessage
          if (statusMsg.status === 'accepted' && statusMsg.jointSession) {
            setInviteStatus('active')
            setJointSession(statusMsg.jointSession)
            jointSessionIdRef.current = statusMsg.jointSession.id
          } else if (statusMsg.status === 'declined') {
            setInviteStatus('declined')
          } else if (statusMsg.status === 'session_ended') {
            setJointSession(null)
            setPartnerProgress(null)
            setInviteStatus('idle')
            setIsPartnerReady(false)
            setMyProgress(null)
            setPartnerCompletedSets([])
          }
          break
        }

        case 'joint_session_ended': {
          setJointSession(null)
          setPartnerProgress(null)
          setInviteStatus('idle')
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
    async (toUserId: string): Promise<boolean> => {
      if (!currentSessionId) return false
      setInviteStatus('sending')
      try {
        const res = await sharingApi.sendJointInvite({ toUserId, fromSessionId: currentSessionId })
        if (!(res as AcceptInviteResponse)?.inviteId) {
          setInviteStatus('error')
          return false
        }
        setInviteStatus('waiting')
        return true
      } catch (err) {
        console.error('Failed to send joint invite:', err)
        setInviteStatus('error')
        return false
      }
    },
    [currentSessionId],
  )

  const acceptInvite = useCallback(async (): Promise<boolean> => {
    if (!pendingInvite) return false
    try {
      const res = (await sharingApi.acceptJointInvite(
        pendingInvite.inviteId as string,
      )) as AcceptInviteResponse
      if (!res?.jointSession) return false
      setPendingInvite(null)
      setInviteStatus('active')
      setJointSession(res.jointSession)
      jointSessionIdRef.current = res.jointSession.id
      return true
    } catch (err) {
      console.error('Failed to accept joint invite:', err)
      return false
    }
  }, [pendingInvite])

  const declineInvite = useCallback(async (): Promise<void> => {
    if (!pendingInvite) return
    try {
      await sharingApi.declineJointInvite(pendingInvite.inviteId as string)
    } catch (_) {}
    setPendingInvite(null)
  }, [pendingInvite])

  const leaveJointSession = useCallback(async (): Promise<void> => {
    const id = jointSessionIdRef.current
    if (id) {
      socket?.send({ type: 'leave_joint_session', jointSessionId: id })
      try {
        await sharingApi.leaveJointSession(id)
      } catch (_) {}
    }
    setJointSession(null)
    setPartnerProgress(null)
    setInviteStatus('idle')
    setIsPartnerReady(false)
    setMyProgress(null)
    setPartnerCompletedSets([])
  }, [socket])

  const pushProgress = useCallback(
    async ({
      exerciseIndex,
      setIndex,
      exerciseName,
      readyForNext = false,
    }: {
      exerciseIndex: number | null
      setIndex: number | null
      exerciseName: string | null
      readyForNext?: boolean
    }): Promise<void> => {
      const id = jointSessionIdRef.current
      if (!id) return

      const exerciseNames = currentDayExercises
        .filter((e) => e.person === selectedPerson)
        .map((e) => ({ name: e.name, sets: e.sets }))
        .filter((e) => e.name)

      const progress = { exerciseIndex, setIndex, exerciseName, readyForNext, exerciseNames }
      setMyProgress(progress as Record<string, unknown>)

      if (socket?.connected) {
        socket.send({ type: 'push_joint_progress', jointSessionId: id, progress })
      } else {
        try {
          await sharingApi.pushJointProgress(id, progress)
        } catch (err) {
          console.warn('Failed to push joint progress:', (err as Error).message)
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
      socket.send({ type: 'push_joint_progress', jointSessionId: id, progress })
    } else {
      sharingApi.pushJointProgress(id, progress).catch(() => {})
    }
  }, [isInJointSession, myExerciseNamesKey])

  useEffect(() => {
    if (!isInJointSession) lastPushedKeyRef.current = null
  }, [isInJointSession])

  const startWatching = useCallback(
    async (friendId: string, friendUsername: string, sessionId: string): Promise<boolean> => {
      setWatchTarget({ friendId, friendUsername, sessionId })
      setWatchSession(null)
      setWatchError(null)
      setWatchLoading(true)
      try {
        const live = await sharingApi.getFriendLiveSession(friendId, sessionId)
        if (!live) {
          setWatchError('session_ended')
          setWatchTarget(null)
          setWatchLoading(false)
          return false
        }
        setWatchSession(live)
        setWatchLoading(false)
        return true
      } catch (err) {
        console.error('Failed to start watching:', (err as Error).message)
        setWatchError('poll_error')
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
