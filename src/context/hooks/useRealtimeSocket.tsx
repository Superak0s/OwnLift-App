// hooks/useRealtimeSocket.ts
//
// Single persistent WebSocket connection for the whole app.

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

function wsUrl(token: string): string {
  const base = getServerUrl().replace(/^http/, "ws")
  return `${base}/ws?token=${encodeURIComponent(token)}`
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
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (!token || !enabled) {
      console.log("[WS_CONNECT_SKIP]", { token: !!token, enabled })
      return
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[WS_ALREADY_OPEN]")
      return
    }

    console.log("[WS_CONNECTING]", wsUrl(token))
    const ws = new WebSocket(wsUrl(token))
    wsRef.current = ws

    ws.onopen = () => {
      console.log("[WS_CONNECTED]")
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
      const delay = retryRef.current
      retryRef.current = Math.min(delay * 2, MAX_RETRY_MS)
      console.log("[WS_RECONNECTING_IN]", delay, "ms")
      retryTimerRef.current = setTimeout(connect, delay)
    }
  }, [token, enabled])

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
