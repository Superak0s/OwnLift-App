import { getServerUrl } from "./config"
import { authenticatedFetch } from "./authenticatedFetch"

// ─── ApiError ─────────────────────────────────────────────────────────────
// Structured error that carries the HTTP status code and optional server-side
// details payload so callers can branch on status (401, 404, 429, …).

export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

// ─── parseApiResponse ─────────────────────────────────────────────────────
// Centralized response parsing: handles JSON parse failures, HTTP errors,
// and server-side `{ success: false }` envelopes in one place.

export async function parseApiResponse<T = unknown>(res: Response): Promise<T> {
  let data: any
  try {
    data = await res.json()
  } catch {
    throw new ApiError(`Invalid JSON response (status ${res.status})`, res.status)
  }

  if (!res.ok || data?.success === false) {
    const message =
      data?.error || data?.message || `Request failed (status ${res.status})`
    throw new ApiError(message, res.status, data?.details)
  }

  return data as T
}

// ─── apiCall ──────────────────────────────────────────────────────────────
// Combines URL resolution, fetch, and response parsing in one helper so
// every "on" service method doesn't need to repeat the boilerplate.
//
// Usage:
//   const data = await apiCall<{ sessions: WorkoutSession[] }>(
//     "/api/sessions", { method: "GET" }
//   )
//
// The path is prefixed with the server URL by authenticatedFetch already,
// so pass relative paths ("/api/...") or absolute URLs.

export async function apiCall<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await authenticatedFetch(url, options)
  return parseApiResponse<T>(res)
}

// ─── callWithLogging ──────────────────────────────────────────────────────
// Wraps an async function with console.error logging on failure and returns
// the result. Replaces the 150+ `try { … } catch { console.error; throw }`
// blocks scattered across every "on" service method.
//
// Usage:
//   logSoreness: async (params) =>
//     callWithLogging("logSoreness", async () => {
//       return apiCall("/api/tracking/soreness", { method: "POST", body: JSON.stringify(params) })
//     })

export async function callWithLogging<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.error(`Error ${label}:`, error)
    throw error
  }
}
