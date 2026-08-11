import { tokenStorage } from "./tokenStorage"
import { getServerUrl } from "./config"
import logger from "./logger"

const DEFAULT_TIMEOUT_MS = 15000

export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
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
