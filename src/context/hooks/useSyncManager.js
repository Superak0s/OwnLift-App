import { useCallback } from "react"

/**
 * Sync Management Hook
 * Handles syncing with the server (offline support)
 */

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
}) => {
  /**
   * Add a pending sync operation
   */
  const addPendingSync = useCallback(
    async (syncData) => {
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
  const syncPendingData = useCallback(async () => {
    if (isSyncing || pendingSyncs.length === 0) return

    setIsSyncing(true)
    console.log(
      `Attempting to sync ${pendingSyncs.length} pending operations...`,
    )

    const failedSyncs = []
    const {
      startSession,
      recordSet,
      endSession,
    } = require("../../services/api")

    for (const sync of pendingSyncs) {
      try {
        switch (sync.type) {
          case "startSession": {
            const sessionId = await startSession(
              sync.data.person,
              sync.data.dayNumber,
              sync.data.dayTitle,
              sync.data.muscleGroups,
              sync.data.isDemo,
            )
            // Update any queued recordSet ops that used the local session ID
            if (sync.localSessionId && sessionId) {
              pendingSyncs.forEach((ps) => {
                if (
                  ps.type === "recordSet" &&
                  ps.data.sessionId === sync.localSessionId
                ) {
                  ps.data.sessionId = String(sessionId)
                }
              })
              if (currentSessionId === sync.localSessionId) {
                await saveToStorage(
                  STORAGE_KEYS.CURRENT_SESSION_ID,
                  String(sessionId),
                  userId,
                )
                setCurrentSessionId(String(sessionId))
              }
            }
            console.log("✓ Synced session start")
            break
          }

          case "recordSet": {
            if (sync.data.sessionId?.startsWith("local_")) {
              console.log("⚠ Skipping recordSet sync for local session ID")
              failedSyncs.push(sync)
              break
            }

            // ← ADD THIS: skip sets with no valid weight/reps
            if (
              !sync.data.weight ||
              sync.data.weight <= 0 ||
              !sync.data.reps ||
              sync.data.reps < 1
            ) {
              console.log(
                "⚠ Dropping invalid queued set (weight/reps = 0), discarding",
              )
              break // drop it — don't push to failedSyncs
            }

            // Use exerciseName (string). Queued syncs from the old code that
            // stored exerciseIndex instead will fall back gracefully — they'll
            // just produce a placeholder exercise name on the server.
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
              sync.data.weight,
              sync.data.reps,
              sync.data.note,
              sync.data.isWarmup,
              sync.data.muscleGroup ?? null,
            )
            console.log("✓ Synced set record")
            break
          }

          case "endSession": {
            if (sync.data.sessionId?.startsWith("local_")) {
              console.log("⚠ Skipping endSession sync for local session ID")
              break
            }

            try {
              await endSession(sync.data.sessionId)
              console.log("✓ Synced session end")
            } catch (error) {
              if (
                error.message?.includes("not found") ||
                error.message?.includes("unauthorized")
              ) {
                console.log("⚠ Session doesn't exist on server - dropping sync")
              } else {
                throw error
              }
            }
            break
          }

          default:
            console.warn("Unknown sync type:", sync.type)
        }
      } catch (error) {
        console.error(`Failed to sync ${sync.type}:`, error.message)
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
  const cleanupInvalidSyncs = useCallback(async () => {
    const validSyncs = pendingSyncs.filter((sync) => {
      if (
        sync.type === "endSession" &&
        sync.data.sessionId?.startsWith("local_")
      ) {
        console.log(
          "🧹 Removing invalid endSession sync for local session:",
          sync.data.sessionId,
        )
        return false
      }

      if (
        sync.type === "recordSet" &&
        sync.data.sessionId?.startsWith("local_")
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
