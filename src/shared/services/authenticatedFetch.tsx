// shared/services/authenticatedFetch.tsx
import { tokenStorage } from "./tokenStorage"
import { getServerUrl } from "./config"

export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  // React Native's fetch cannot resolve relative URLs (there is no document
  // origin), so callers that pass a path like "/api/sessions" fail with
  // "Network request failed". Prefix those with the configured server URL.
  // Callers that already pass an absolute URL (http/https) are left untouched.
  const resolvedUrl = /^https?:\/\//i.test(url) ? url : `${getServerUrl()}${url}`

  console.log(`[API] Calling: ${resolvedUrl}`)
  const token = await tokenStorage.get()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers as Record<string, string>),
  }

  const response = await fetch(resolvedUrl, { ...options, headers })

  if (response.status === 401) {
    const data = await response.json()
    if (data.error === "Token expired" || data.error?.includes("expired")) {
      console.warn("⚠️ Token expired - clearing token")
      await tokenStorage.clear()
      throw new Error("SESSION_EXPIRED")
    }
  }

  return response
}
