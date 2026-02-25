// hooks/useRealtimeSocket.js
//
// Single persistent WebSocket connection for the whole app.
// Replaces every setInterval in useJointSession:
//   ✗  pollJointSession      every 4s
//   ✗  pollForInvites        every 8s
//   ✗  pollWatchSession      every 5s
//   ✗  useFriendSessionStatuses  every 15s (FriendsScreen)
//
// Usage:
//   const socket = useRealtimeSocket({ token, enabled: !!userId })
//   socket.send({ type: "push_joint_progress", jointSessionId, progress })
//
// Incoming messages are dispatched through the onMessage callback passed in,
// or consumed via socket.lastMessage (the last parsed message object).
//
// Reconnection: exponential back-off up to 30s, resets on success.
// The hook survives app backgrounding — React Native fires the AppState
// change and we close + reopen cleanly.

import { useEffect, useRef, useCallback, useState } from "react"
import { AppState } from "react-native"
import { getServerUrl } from "../../services/config"

const BASE_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

function wsUrl(token) {
  const base = getServerUrl().replace(/^http/, "ws")
  return `${base}/ws?token=${encodeURIComponent(token)}`
}

export function useRealtimeSocket({ token, enabled = true, onMessage }) {
  const wsRef = useRef(null)
  const retryRef = useRef(BASE_RETRY_MS)
  const retryTimerRef = useRef(null)
  const onMessageRef = useRef(onMessage)
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)

  // Keep callback ref fresh without re-triggering connect
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

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        console.log("[WS_MESSAGE_RECEIVED]", msg.type, msg)
        setLastMessage(msg)
        onMessageRef.current?.(msg)
      } catch (e) {
        console.warn("[WS_PARSE_ERROR]", e.message)
      }
    }

    ws.onerror = (e) => {
      console.warn("[WS_ERROR]", e.message)
    }

    ws.onclose = (e) => {
      console.log("[WS_CLOSED]", e.code, e.reason)
      setConnected(false)
      wsRef.current = null
      if (!enabled) return
      const delay = retryRef.current
      retryRef.current = Math.min(delay * 2, MAX_RETRY_MS)
      console.log(`[WS_RECONNECTING_IN]`, delay, "ms")
      retryTimerRef.current = setTimeout(connect, delay)
    }
  }, [token, enabled])

  const disconnect = useCallback(() => {
    clearTimeout(retryTimerRef.current)
    wsRef.current?.close(1000, "unmount")
    wsRef.current = null
    setConnected(false)
  }, [])

  const send = useCallback((data) => {
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
  }, [])

  // Connect / disconnect on mount and when token/enabled changes
  useEffect(() => {
    if (enabled && token) {
      connect()
    } else {
      disconnect()
    }
    return disconnect
  }, [token, enabled, connect, disconnect])

  // Handle app backgrounding (iOS/Android suspend the network)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // Reconnect if the socket died while backgrounded
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          clearTimeout(retryTimerRef.current)
          retryRef.current = BASE_RETRY_MS
          connect()
        }
      } else {
        // Background/inactive: close cleanly so the server knows we left
        wsRef.current?.close(1000, "background")
        wsRef.current = null
        setConnected(false)
      }
    })
    return () => sub.remove()
  }, [connect])

  return { send, connected, lastMessage }
}
