import { getServerUrl } from "./config"
import { authenticatedFetch } from "./authenticatedFetch"

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

export async function parseApiResponse<T = unknown>(res: Response): Promise<T> {
  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new ApiError(`Invalid JSON response (status ${res.status})`, res.status)
  }

  const body = (data && typeof data === "object" ? data : {}) as {
    success?: boolean
    error?: string
    message?: string
    details?: unknown
  }

  if (!res.ok || body.success === false) {
    const message = body.error || body.message || `Request failed (status ${res.status})`
    throw new ApiError(message, res.status, body.details)
  }

  return data as T
}

export async function apiCall<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await authenticatedFetch(url, options)
  return parseApiResponse<T>(res)
}

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
