// src/shared/hooks/useTwoFingerPull.ts
//
// Detects a two-finger downward drag anywhere on the wrapped view, the
// same gesture Android uses to open the widget picker. Built on the
// built-in PanResponder so it needs no extra native dependencies.
//
// Usage:
//   const { panHandlers, pullDistance, isPulling } = useTwoFingerPull(() => {
//     setGalleryVisible(true)
//   })
//   <View {...panHandlers}>...</View>

import { useRef, useState, useCallback } from "react"
import { PanResponder, type GestureResponderEvent } from "react-native"

const TRIGGER_DISTANCE = 90 // px of downward travel needed to fire onTrigger

export function useTwoFingerPull(
  onTrigger: () => void,
  enabled: boolean = true,
) {
  const [pullDistance, setPullDistance] = useState(0)
  const triggeredRef = useRef(false)

  const isTwoFingerTouch = (evt: GestureResponderEvent) =>
    evt.nativeEvent.touches.length === 2

  const panResponder = useRef(
    PanResponder.create({
      // Capture as soon as a second finger comes down so a ScrollView
      // underneath doesn't steal the gesture first.
      onStartShouldSetPanResponderCapture: (evt) =>
        enabled && isTwoFingerTouch(evt),
      onMoveShouldSetPanResponderCapture: (evt, gestureState) =>
        enabled && isTwoFingerTouch(evt) && gestureState.dy > 4,

      onPanResponderGrant: () => {
        triggeredRef.current = false
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isTwoFingerTouch(evt) || gestureState.dy < 0) {
          setPullDistance(0)
          return
        }
        setPullDistance(gestureState.dy)
        if (gestureState.dy > TRIGGER_DISTANCE && !triggeredRef.current) {
          triggeredRef.current = true
          onTrigger()
        }
      },
      onPanResponderRelease: () => {
        setPullDistance(0)
      },
      onPanResponderTerminate: () => {
        setPullDistance(0)
      },
    }),
  ).current

  const reset = useCallback(() => {
    triggeredRef.current = false
    setPullDistance(0)
  }, [])

  return {
    panHandlers: panResponder.panHandlers,
    pullDistance,
    isPulling: pullDistance > 0,
    reset,
  }
}
