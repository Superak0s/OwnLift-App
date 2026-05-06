// hooks/useRealtimeSocket.ts
//
// Single persistent WebSocket connection for the whole app.
// Security fix: JWT is sent as the first message after connection opens,
// NOT as a URL query parameter (which would appear in server/proxy logs).

import { useEffect, useRef, useCallback, useState } from "react"
import { AppState } from "react-native"
import { getServerUrl } from "../../services/config"

const BASE_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

export interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

export interface RealtimeSocket {
  send: (data: WebSocketMessage) => void
  connected: boolean
  lastMessage: WebSocketMessage | null
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
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef<((msg: WebSocketMessage) => void) | undefined>(
    onMessage,
  )
  // Keep a ref to the latest token so the auth message always uses a fresh value
  const tokenRef = useRef<string | null>(token)
  const [connected, setConnected] = useState(false)
  const [authError, setAuthError] = useState(false) // Add this
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  const connect = useCallback(() => {
    if (!tokenRef.current || !enabled) {
      console.log("[WS_CONNECT_SKIP]", { token: !!tokenRef.current, enabled })
      return
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[WS_ALREADY_OPEN]")
      return
    }

    // Connect without the token in the URL — send it as the first message
    // after the handshake completes so it never appears in access logs.
    console.log("[WS_CONNECTING]", wsUrl())
    const ws = new WebSocket(wsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      console.log("[WS_CONNECTED] Sending auth message")
      // Authenticate immediately — server should enforce a short timeout
      // and close the connection if this message is not received.
      ws.send(JSON.stringify({ type: "auth", token: tokenRef.current }))
      setConnected(true)
      retryRef.current = BASE_RETRY_MS
    }

    ws.onmessage = (event: WebSocketMessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WebSocketMessage
        console.log("[WS_MESSAGE_RECEIVED]", msg.type, msg)
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
      console.log("[WS_CLOSED]", e.code, e.reason)
      setConnected(false)
      wsRef.current = null
      if (!enabled) return

      // Don't retry on auth failures or other client errors
      if (e.code && e.code >= 4000 && e.code < 4100) {
        setAuthError(true) // Signal to UI
        console.warn("[WS_AUTH_FAILED]", e.code, e.reason)
        return
      }

      const delay = retryRef.current
      retryRef.current = Math.min(delay * 2, MAX_RETRY_MS)
      console.log("[WS_RECONNECTING_IN]", delay, "ms")
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
      console.log("[WS_SEND]", data.type, data)
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
    if (enabled && token) {
      connect()
    } else {
      disconnect()
    }
    return disconnect
  }, [token, enabled, connect, disconnect])

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
          retryRef.current = BASE_RETRY_MS
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

  return { send, connected, lastMessage }
}
