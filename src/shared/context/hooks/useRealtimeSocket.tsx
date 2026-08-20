// Single persistent WebSocket connection for the whole app.
// Security fix: JWT is sent as the first message after connection opens,
// NOT as a URL query parameter (which would appear in server/proxy logs).
//
// Reliability fix: when the server rejects the token (close code 4000-4099),
// we remember *that specific token* failed and refuse to retry with it —
// otherwise anything that calls connect() again (the AppState "active"
// listener firing, the mount effect, etc.) immediately reopens a socket
// with the same bad token, gets closed again, and the cycle repeats with
// no backoff, spamming WS_CONNECTING / WS_AUTH_FAILED forever. The guard
// lives inside connect() itself so it protects every caller, not just the
// exponential-backoff retry path.
//
// Offline-mode fix: realtime features (joint sessions, live watch, etc.)
// are server-only — there is no "offline" equivalent. This hook now checks
// isServerless() and refuses to open a connection at all while the app is
// in offline mode, instead of trying to connect with whatever token the
// offline auth stub produces (which isn't a real JWT, hence the endless
// "jwt malformed" 4001 loop).

import { useEffect, useRef, useCallback, useState } from "react"
import { AppState } from "react-native"
import { getServerUrl } from "../../services/config"
import {
  isServerless,
  onAppModeChange,
} from "../../services/appMode"
import logger from "../../services/logger"

const BASE_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000
// A server that's down for good (or unreachable) would otherwise retry with
// exponential backoff forever. Give up after enough failures instead of
// reconnecting every 30s indefinitely; AppState going active resets the count.
const MAX_RETRY_ATTEMPTS = 10

export interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

export interface RealtimeSocket {
  send: (data: WebSocketMessage) => void
  connected: boolean
  lastMessage: WebSocketMessage | null
  /**
   * True once the server has rejected the current token (e.g. expired or
   * malformed JWT). Stays true — and the socket stays disconnected — until
   * a *different* token is supplied. Surface this in the UI (e.g. to force
   * a re-login or token refresh) instead of silently retrying forever.
   */
  authError: boolean
  /**
   * True once reconnection attempts have been exhausted (MAX_RETRY_ATTEMPTS
   * failures in a row). Stays true until the app is foregrounded again or
   * the token changes, both of which trigger a fresh attempt.
   */
  connectionFailed: boolean
}

export interface UseRealtimeSocketOptions {
  token: string | null
  enabled?: boolean
  onMessage?: (msg: WebSocketMessage) => void
}

function wsUrl(): string {
  const base = getServerUrl().replace(/^http/, "ws")
  return `${base}/ws`
}

export function useRealtimeSocket({
  token,
  enabled = true,
  onMessage,
}: UseRealtimeSocketOptions): RealtimeSocket {
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number>(BASE_RETRY_MS)
  const retryCountRef = useRef<number>(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef<((msg: WebSocketMessage) => void) | undefined>(
    onMessage,
  )
  // Keep a ref to the latest token so the auth message always uses a fresh value
  const tokenRef = useRef<string | null>(token)
  // Remembers the last token the server rejected with a 4000-4099 close
  // code. connect() refuses to open a new socket while tokenRef.current
  // still equals this value — cleared automatically once the token changes.
  const authFailedTokenRef = useRef<string | null>(null)
  // Mirrors isServerless() in a ref so the stable `connect` callback always
  // reads the current value instead of one captured at creation time.
  const offlineRef = useRef<boolean>(false)
  const [connected, setConnected] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [isOffline, setIsOffline] = useState<boolean>(true)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    tokenRef.current = token
    // A new (or newly-null) token deserves a fresh attempt, even if the
    // previous one was rejected.
    if (
      authFailedTokenRef.current !== null &&
      authFailedTokenRef.current !== token
    ) {
      authFailedTokenRef.current = null
      setAuthError(false)
    }
    retryCountRef.current = 0
    setConnectionFailed(false)
  }, [token])

  // Load the persisted app mode once, then stay in sync with it. Nothing
  // in this hook should attempt a socket connection until this resolves.
  useEffect(() => {
    void isServerless().then((offline) => {
      offlineRef.current = offline
      setIsOffline(offline)
    })
    return onAppModeChange.subscribe((mode) => {
      const offline = mode === "offline"
      offlineRef.current = offline
      setIsOffline(offline)
      if (offline) {
        logger.debug("[WS_MODE_OFFLINE] Disconnecting realtime socket")
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
        wsRef.current?.close(1000, "offline mode")
        wsRef.current = null
        setConnected(false)
      }
    })
  }, [])

  const connect = useCallback(() => {
    if (offlineRef.current) {
      logger.debug("[WS_CONNECT_SKIP_OFFLINE]")
      return
    }
    if (!tokenRef.current || !enabled) {
      logger.debug("[WS_CONNECT_SKIP]", { token: !!tokenRef.current, enabled })
      return
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      logger.debug("[WS_ALREADY_OPEN]")
      return
    }
    if (
      authFailedTokenRef.current !== null &&
      authFailedTokenRef.current === tokenRef.current
    ) {
      // This exact token was already rejected by the server. Don't hammer
      // it — wait for a new token (see the tokenRef sync effect above).
      logger.debug("[WS_SKIP_KNOWN_BAD_TOKEN]")
      return
    }

    // Connect without the token in the URL — send it as the first message
    // after the handshake completes so it never appears in access logs.
    logger.debug("[WS_CONNECTING]", wsUrl())
    const ws = new WebSocket(wsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      logger.debug("[WS_CONNECTED] Sending auth message")
      // Authenticate immediately — server should enforce a short timeout
      // and close the connection if this message is not received.
      ws.send(JSON.stringify({ type: "auth", token: tokenRef.current }))
      setConnected(true)
      retryRef.current = BASE_RETRY_MS
      retryCountRef.current = 0
      setConnectionFailed(false)
    }

    ws.onmessage = (event: WebSocketMessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WebSocketMessage
        setLastMessage(msg)
        onMessageRef.current?.(msg)
      } catch (e) {
        console.warn("[WS_PARSE_ERROR]", (e as Error).message)
      }
    }

    ws.onerror = (e: Event) => {
      console.warn("[WS_ERROR]", (e as unknown as { message?: string }).message)
    }

    ws.onclose = (e: WebSocketCloseEvent) => {
      logger.debug("[WS_CLOSED]", e.code, e.reason)
      setConnected(false)
      wsRef.current = null
      if (!enabled) return
      if (offlineRef.current) return

      // Don't retry on auth failures or other client errors — remember
      // this token so nothing else (AppState, effects) re-triggers a
      // pointless reconnect loop with the same bad token.
      if (e.code && e.code >= 4000 && e.code < 4100) {
        authFailedTokenRef.current = tokenRef.current
        setAuthError(true)
        console.warn("[WS_AUTH_FAILED]", e.code, e.reason)
        return
      }

      retryCountRef.current += 1
      if (retryCountRef.current > MAX_RETRY_ATTEMPTS) {
        logger.warn(
          "[WS_GIVE_UP]",
          `after ${retryCountRef.current} failed attempts`,
        )
        setConnectionFailed(true)
        return
      }

      const delay = retryRef.current
      retryRef.current = Math.min(delay * 2, MAX_RETRY_MS)
      logger.debug("[WS_RECONNECTING_IN]", delay, "ms")
      retryTimerRef.current = setTimeout(connect, delay)
    }
  }, [enabled])

  const disconnect = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    wsRef.current?.close(1000, "unmount")
    wsRef.current = null
    setConnected(false)
  }, [])

  const send = useCallback(
    (data: WebSocketMessage) => {
      if (offlineRef.current) return
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data))
      } else {
        console.warn("[WS_SEND_FAILED]", {
          readyState: wsRef.current?.readyState,
          connected,
          dataType: data.type,
        })
      }
    },
    [connected],
  )

  useEffect(() => {
    if (enabled && token && !isOffline) {
      connect()
    } else {
      disconnect()
    }
    return disconnect
  }, [token, enabled, isOffline, connect, disconnect])

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (offlineRef.current) return
      if (state === "active") {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
          retryRef.current = BASE_RETRY_MS
          retryCountRef.current = 0
          setConnectionFailed(false)
          connect()
        }
      } else {
        wsRef.current?.close(1000, "background")
        wsRef.current = null
        setConnected(false)
      }
    })
    return () => sub.remove()
  }, [connect])

  return { send, connected, lastMessage, authError, connectionFailed }
}
