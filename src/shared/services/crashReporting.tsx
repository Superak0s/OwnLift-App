import * as Sentry from "@sentry/react-native"
import logger from "@shared/services/logger"

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN

export const initCrashReporting = (): void => {
  installUnhandledRejectionHandler()
  if (!dsn) {
    logger.warn("EXPO_PUBLIC_SENTRY_DSN not set — crash reporting disabled")
    return
  }
  Sentry.init({ dsn, enabled: !__DEV__ })
}

export const captureException = (error: unknown): void => {
  if (dsn) Sentry.captureException(error)
}

// Sentry's own rejection tracker only attaches once Sentry.init() runs (i.e.
// only when a DSN is configured), so unhandled rejections would otherwise go
// completely unlogged whenever the DSN is missing. Hermes' native tracker is
// a backstop that always logs, independent of Sentry being configured.
function installUnhandledRejectionHandler(): void {
  const hermesInternal = (globalThis as Record<string, unknown>).HermesInternal as
    | {
        hasPromise?: () => boolean
        enablePromiseRejectionTracker?: (options: {
          allRejections: boolean
          onUnhandled: (id: number, error: unknown) => void
        }) => void
      }
    | undefined

  if (!hermesInternal?.hasPromise?.() || !hermesInternal.enablePromiseRejectionTracker) {
    return
  }

  hermesInternal.enablePromiseRejectionTracker({
    allRejections: true,
    onUnhandled: (_id, error) => {
      logger.error("Unhandled promise rejection:", error)
      captureException(error)
    },
  })
}
