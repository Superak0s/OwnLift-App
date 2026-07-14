// shared/services/authenticatedFetch.tsx
import { tokenStorage } from "./tokenStorage"

export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  console.log(`[API] Calling: ${url}`)
  const token = await tokenStorage.get()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers as Record<string, string>),
  }

  const response = await fetch(url, { ...options, headers })

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
