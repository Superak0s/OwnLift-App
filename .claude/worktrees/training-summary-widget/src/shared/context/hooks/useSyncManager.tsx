import { useCallback, useRef } from "react"
import { workoutApi } from "@features/workout/services/index"
import { filterOutLocalSessionSyncs, getLocalISOString } from "@utils/session"
import logger from "../../services/logger"
import type { PendingSync } from "../../types"

/**
 * Sync Management Hook
 * Handles syncing with the server (offline support)
 */

export interface UseSyncManagerOptions {
  pendingSyncs: PendingSync[]
  setPendingSyncs: (syncs: PendingSync[]) => void
  isSyncing: boolean
  setIsSyncing: (syncing: boolean) => void
  currentSessionId: string | null
  setCurrentSessionId: (id: string) => void
  userId: string | null
  saveToStorage: (
    key: string,
    value: unknown,
    userId: string | null,
  ) => Promise<boolean>
  STORAGE_KEYS: { PENDING_SYNCS: string; CURRENT_SESSION_ID: string }
  useManualTime: boolean
  fetchAnalytics?: (() => Promise<void>) | null
}

export interface UseSyncManagerReturn {
  addPendingSync: (syncData: PendingSync) => Promise<void>
  syncPendingData: () => Promise<void>
  cleanupInvalidSyncs: () => Promise<void>
}

// A sync that keeps failing (e.g. server permanently unreachable, or a
// payload the server will never accept) would otherwise get retried every
// 30s forever. Back off exponentially per sync and give up after enough
// failures instead of hammering the server.
const MAX_SYNC_RETRIES = 8
const BASE_BACKOFF_MS = 30_000
const MAX_BACKOFF_MS = 30 * 60_000

export const useSyncManager = ({
  pendingSyncs,
  setPendingSyncs,
  isSyncing,
  setIsSyncing,
  currentSessionId,
  setCurrentSessionId,
  userId,
  saveToStorage,
  STORAGE_KEYS,
  useManualTime,
  fetchAnalytics,
}: UseSyncManagerOptions): UseSyncManagerReturn => {
  const retryStateRef = useRef(
    new Map<string, { count: number; nextAttemptAt: number }>(),
  )

  /**
   * Add a pending sync operation
   */
  const addPendingSync = useCallback(
    async (syncData: PendingSync): Promise<void> => {
      try {
        const newPendingSyncs = [...pendingSyncs, syncData]
        await saveToStorage(STORAGE_KEYS.PENDING_SYNCS, newPendingSyncs, userId)
        setPendingSyncs(newPendingSyncs)
      } catch (error) {
        console.error("Error adding pending sync:", error)
      }
    },
    [pendingSyncs, setPendingSyncs, userId, saveToStorage, STORAGE_KEYS],
  )

  /**
   * Sync pending data
   */
  const syncPendingData = useCallback(async (): Promise<void> => {
    if (isSyncing || pendingSyncs.length === 0) return

    setIsSyncing(true)
    logger.debug(
      `Attempting to sync ${pendingSyncs.length} pending operations...`,
    )

    // FIX 3: Spreading `{ ...s, data: { ...s.data } }` collapses the discriminated
    // union — TypeScript widens `data` to the union of all three data shapes and
    // the resulting object no longer satisfies any single PendingSync variant.
    // Use structuredClone to deep-copy while preserving the original type, then
    // assert back to PendingSync[] so the compiler trusts the invariant.
    let workingSyncs: PendingSync[] = structuredClone(
      pendingSyncs,
    ) as PendingSync[]

    const failedSyncs: PendingSync[] = []
    // Maps a local session ID to its server ID once startSession syncs for it,
    // so later recordSet/endSession entries can resolve it in one pass instead
    // of each startSession rescanning the rest of the queue.
    const localToServerId = new Map<string, string>()

    const now = Date.now()

    for (let i = 0; i < workingSyncs.length; i++) {
      const sync = workingSyncs[i]
      if (sync.type === "recordSet" || sync.type === "endSession") {
        const mapped = localToServerId.get(String(sync.data.sessionId))
        if (mapped) sync.data.sessionId = mapped
      }

      const retryKey = String(sync.timestamp)
      const retryState = retryStateRef.current.get(retryKey)
      if (retryState && retryState.nextAttemptAt > now) {
        failedSyncs.push(sync)
        continue
      }

      try {
        switch (sync.type) {
          case "startSession": {
            // sync.data is StartSessionSyncData — fully typed, no casts needed
            const sessionId = await workoutApi.startSession(
              sync.data.person,
              sync.data.dayNumber,
              sync.data.dayTitle,
              sync.data.muscleGroups,
              sync.data.isDemo,
            )

            if (sync.localSessionId && sessionId) {
              const serverIdStr = String(sessionId)
              // Without remapping endSession too, a session started AND
              // ended offline keeps its local ID here, hits the
              // startsWith("local_") guard below, gets dropped, and the
              // session stays open on the server forever.
              localToServerId.set(sync.localSessionId, serverIdStr)
              if (currentSessionId === sync.localSessionId) {
                await saveToStorage(
                  STORAGE_KEYS.CURRENT_SESSION_ID,
                  serverIdStr,
                  userId,
                )
                setCurrentSessionId(serverIdStr)
              }
            }
            logger.info("✓ Synced session start")
            break
          }

          case "recordSet": {
            // sync.data is RecordSetSyncData — fully typed
            if (String(sync.data.sessionId).startsWith("local_")) {
              logger.warn("⚠ Skipping recordSet sync for local session ID")
              failedSyncs.push(sync)
              break
            }

            const { weight, reps } = sync.data

            if (!weight || weight <= 0 || !reps || reps < 1) {
              logger.warn(
                "⚠ Dropping invalid queued set (weight/reps = 0), discarding",
              )
              break
            }

            const exerciseName =
              sync.data.exerciseName ??
              (sync.data.exerciseIndex !== undefined
                ? `Exercise ${sync.data.exerciseIndex}`
                : "Unknown Exercise")

            try {
              await workoutApi.recordSet(
                sync.data.sessionId,
                exerciseName,
                sync.data.setIndex,
                sync.data.startTime,
                sync.data.endTime,
                weight,
                reps,
                sync.data.note,
                sync.data.isWarmup,
                sync.data.muscleGroup ?? null,
              )
              logger.info("✓ Synced set record")
            } catch (error) {
              // The session this set belonged to is gone for good (e.g. it
              // was already ended/cleared) — same "not found" handling as
              // endSession below. Without this, a set queued against a dead
              // session retries and fails forever instead of being dropped.
              if (
                (error as Error).message?.includes("not found") ||
                (error as Error).message?.includes("unauthorized")
              ) {
                logger.warn("⚠ Session for queued set no longer exists - dropping sync")
              } else {
                throw error
              }
            }
            break
          }

          case "endSession": {
            // sync.data is EndSessionSyncData — fully typed
            if (String(sync.data.sessionId).startsWith("local_")) {
              logger.warn("⚠ Skipping endSession sync for local session ID")
              break
            }

            try {
              await workoutApi.endSession(
                sync.data.sessionId,
                getLocalISOString(),
              )
              logger.info("✓ Synced session end")
            } catch (error) {
              if (
                (error as Error).message?.includes("not found") ||
                (error as Error).message?.includes("unauthorized")
              ) {
                logger.warn("⚠ Session no longer exists - dropping sync")
              } else {
                throw error
              }
            }
            break
          }

          default:
            console.warn("Unknown sync type:", (sync as PendingSync).type)
        }
        retryStateRef.current.delete(retryKey)
      } catch (error) {
        console.error(`Failed to sync ${sync.type}:`, (error as Error).message)

        const nextCount = (retryState?.count ?? 0) + 1
        if (nextCount > MAX_SYNC_RETRIES) {
          logger.warn(
            `⚠ Dropping ${sync.type} sync after ${nextCount} failed attempts`,
          )
          retryStateRef.current.delete(retryKey)
        } else {
          const backoff = Math.min(
            BASE_BACKOFF_MS * 2 ** (nextCount - 1),
            MAX_BACKOFF_MS,
          )
          retryStateRef.current.set(retryKey, {
            count: nextCount,
            nextAttemptAt: now + backoff,
          })
          failedSyncs.push(sync)
        }
      }
    }

    await saveToStorage(STORAGE_KEYS.PENDING_SYNCS, failedSyncs, userId)
    setPendingSyncs(failedSyncs)

    if (failedSyncs.length === 0) {
      logger.info("✓ All pending syncs completed successfully!")
      if (!useManualTime && fetchAnalytics) {
        await fetchAnalytics()
      }
    } else {
      logger.warn(`⚠ ${failedSyncs.length} syncs still pending`)
    }

    setIsSyncing(false)
  }, [
    isSyncing,
    pendingSyncs,
    setIsSyncing,
    setPendingSyncs,
    currentSessionId,
    setCurrentSessionId,
    userId,
    saveToStorage,
    STORAGE_KEYS,
    useManualTime,
    fetchAnalytics,
  ])

  /**
   * Clean up invalid syncs
   */
  const cleanupInvalidSyncs = useCallback(async (): Promise<void> => {
    const validSyncs = filterOutLocalSessionSyncs(pendingSyncs)

    if (validSyncs.length !== pendingSyncs.length) {
      await saveToStorage(STORAGE_KEYS.PENDING_SYNCS, validSyncs, userId)
      setPendingSyncs(validSyncs)
      logger.debug(
        `🧹 Cleaned up ${pendingSyncs.length - validSyncs.length} invalid syncs`,
      )
    }
  }, [pendingSyncs, setPendingSyncs, userId, saveToStorage, STORAGE_KEYS])

  return {
    addPendingSync,
    syncPendingData,
    cleanupInvalidSyncs,
  }
}
