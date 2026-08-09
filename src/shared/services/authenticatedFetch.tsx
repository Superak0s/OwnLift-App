// shared/services/authenticatedFetch.tsx
import { tokenStorage } from "./tokenStorage"
import { getServerUrl } from "./config"
import logger from "./logger"

const DEFAULT_TIMEOUT_MS = 15000

export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  // React Native's fetch cannot resolve relative URLs (there is no document
  // origin), so callers that pass a path like "/api/workouts" fail with
  // "Network request failed". Prefix those with the configured server URL.
  // Callers that already pass an absolute URL (http/https) are left untouched.
  const resolvedUrl = /^https?:\/\//i.test(url)
    ? url
    : `${getServerUrl()}${url}`

  logger.debug(`[API] Calling: ${resolvedUrl}`)
  const token = await tokenStorage.get()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers as Record<string, string>),
  }

  // Callers that already pass their own signal (e.g. to cancel on unmount)
  // own the abort logic; only impose our timeout when none was given.
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  let signal = options.signal
  if (!signal) {
    const controller = new AbortController()
    timeoutHandle = setTimeout(
      () => controller.abort(),
      DEFAULT_TIMEOUT_MS,
    )
    signal = controller.signal
  }

  let response: Response
  try {
    response = await fetch(resolvedUrl, { ...options, headers, signal })
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }

  if (response.status === 401) {
    // Read a CLONE so the original response body stays intact for callers
    // that handle non-expiry 401s themselves (reading it here would leave the
    // returned response with an already-consumed body → "Already read" throw).
    const data = await response
      .clone()
      .json()
      .catch(() => ({}) as { error?: string })
    if (data.error === "Token expired" || data.error?.includes("expired")) {
      console.warn("⚠️ Token expired - clearing token")
      await tokenStorage.clear()
      throw new Error("SESSION_EXPIRED")
    }
  }

  return response
}
