import { useCallback } from "react"
import { startSession, recordSet, endSession } from "../../services/api"
import type { PendingSync } from "../../types/index"

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
   * Sync pending data to server
   */
  const syncPendingData = useCallback(async (): Promise<void> => {
    if (isSyncing || pendingSyncs.length === 0) return

    setIsSyncing(true)
    console.log(
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

    for (let i = 0; i < workingSyncs.length; i++) {
      const sync = workingSyncs[i]
      try {
        switch (sync.type) {
          case "startSession": {
            // sync.data is StartSessionSyncData — fully typed, no casts needed
            const sessionId = await startSession(
              sync.data.person,
              sync.data.dayNumber,
              sync.data.dayTitle,
              sync.data.muscleGroups,
              sync.data.isDemo,
            )

            if (sync.localSessionId && sessionId) {
              const serverIdStr = String(sessionId)
              // Remap all subsequent syncs that reference this local ID.
              // structuredClone gave us independent objects so we can mutate
              // data in-place safely without touching the original state.
              for (let j = i + 1; j < workingSyncs.length; j++) {
                const ps = workingSyncs[j]
                if (
                  ps.type === "recordSet" &&
                  ps.data.sessionId === sync.localSessionId
                ) {
                  ps.data.sessionId = serverIdStr
                }
              }
              if (currentSessionId === sync.localSessionId) {
                await saveToStorage(
                  STORAGE_KEYS.CURRENT_SESSION_ID,
                  serverIdStr,
                  userId,
                )
                setCurrentSessionId(serverIdStr)
              }
            }
            console.log("✓ Synced session start")
            break
          }

          case "recordSet": {
            // sync.data is RecordSetSyncData — fully typed
            if (String(sync.data.sessionId).startsWith("local_")) {
              console.log("⚠ Skipping recordSet sync for local session ID")
              failedSyncs.push(sync)
              break
            }

            const { weight, reps } = sync.data

            if (!weight || weight <= 0 || !reps || reps < 1) {
              console.log(
                "⚠ Dropping invalid queued set (weight/reps = 0), discarding",
              )
              break
            }

            const exerciseName =
              sync.data.exerciseName ??
              (sync.data.exerciseIndex !== undefined
                ? `Exercise ${sync.data.exerciseIndex}`
                : "Unknown Exercise")

            await recordSet(
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
            console.log("✓ Synced set record")
            break
          }

          case "endSession": {
            // sync.data is EndSessionSyncData — fully typed
            if (String(sync.data.sessionId).startsWith("local_")) {
              console.log("⚠ Skipping endSession sync for local session ID")
              break
            }

            try {
              await endSession(sync.data.sessionId)
              console.log("✓ Synced session end")
            } catch (error) {
              if (
                (error as Error).message?.includes("not found") ||
                (error as Error).message?.includes("unauthorized")
              ) {
                console.log("⚠ Session doesn't exist on server - dropping sync")
              } else {
                throw error
              }
            }
            break
          }

          default:
            console.warn("Unknown sync type:", (sync as PendingSync).type)
        }
      } catch (error) {
        console.error(`Failed to sync ${sync.type}:`, (error as Error).message)
        failedSyncs.push(sync)
      }
    }

    await saveToStorage(STORAGE_KEYS.PENDING_SYNCS, failedSyncs, userId)
    setPendingSyncs(failedSyncs)

    if (failedSyncs.length === 0) {
      console.log("✓ All pending syncs completed successfully!")
      if (!useManualTime && fetchAnalytics) {
        await fetchAnalytics()
      }
    } else {
      console.log(`⚠ ${failedSyncs.length} syncs still pending`)
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
    const validSyncs = pendingSyncs.filter((sync) => {
      if (
        sync.type === "endSession" &&
        String(sync.data.sessionId).startsWith("local_")
      ) {
        console.log(
          "🧹 Removing invalid endSession sync for local session:",
          sync.data.sessionId,
        )
        return false
      }

      if (
        sync.type === "recordSet" &&
        String(sync.data.sessionId).startsWith("local_")
      ) {
        console.log(
          "🧹 Removing invalid recordSet sync for local session:",
          sync.data.sessionId,
        )
        return false
      }

      return true
    })

    if (validSyncs.length !== pendingSyncs.length) {
      await saveToStorage(STORAGE_KEYS.PENDING_SYNCS, validSyncs, userId)
      setPendingSyncs(validSyncs)
      console.log(
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
