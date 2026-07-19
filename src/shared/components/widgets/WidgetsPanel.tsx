// src/shared/components/widgets/WidgetsPanel.tsx
//
// Renders whatever widgets the user has placed. Editing controls (resize,
// remove, drag-to-reorder) only appear while `editMode` is true — driven by
// the parent screen via the two-finger pull gesture or an Edit/Done toggle.
// Outside edit mode, widgets are plain display cards.
//
// In edit mode:
//   - Tap a widget's body to cycle its size (small -> medium -> large,
//     wrapping).
//   - Drag the grip handle (⠿) in a widget's header to reorder it anywhere
//     in the grid, Android-homescreen style. Other widgets slide out of the
//     way live; the drop position is committed on release.
//   - Tap the ✕ in a widget's header to remove it.
//
// Drag-and-drop is built entirely on Animated + PanResponder, no extra
// native dependencies.
//
// How the drag works:
//   - Every widget's on-screen box (x/y/width/height, relative to the
//     flex-wrap container) is captured via onLayout into layoutsRef.
//   - While a widget is being dragged, it's rendered twice: an invisible
//     placeholder that stays in normal flow (so the grid keeps the right
//     amount of space) and a floating, absolutely positioned copy that
//     tracks the finger via Animated.ValueXY, anchored to the box it
//     started in.
//   - Crucially, the underlying render order (`orderIds`, the thing that
//     actually drives Yoga/flex layout) is NOT touched while the drag is
//     in progress. Reordering the real array mid-drag means every other
//     widget gets a real relayout on every single swap — and since that
//     relayout is async (native computes the new frame, then JS finds out
//     about it later via onLayout), there's an unavoidable frame where a
//     widget has already snapped to its new position before any
//     compensating animation can kick in. Do that on every swap during a
//     fast drag and it reads as flicker/jitter, not a smooth reorder.
//   - Instead, reordering during the drag is entirely simulated: as the
//     finger moves, we hit-test its center point against a *frozen*
//     snapshot of every widget's box (dragGridSnapshotRef, captured once
//     at drag start — see the comment above that ref for why it must be
//     frozen). Crossing into a neighboring box updates a purely-logical
//     target order (dragOrderRef) and calls retargetSlots(), which gives
//     every affected widget a synchronous Animated.spring translate
//     offset toward where it *would* sit under that target order — using
//     the same frozen boxes, so no measurement round-trip is involved at
//     all. The real widgets never move in the underlying layout; they
//     just slide via transform.
//   - Only on release/terminate do we commit the target order for real
//     (setOrderIds), which triggers exactly one relayout for the whole
//     gesture. Any tiny gap between the simulated position and where Yoga
//     actually puts things (e.g. if reordering changed how rows wrap, or
//     the swap crossed widgets of different sizes) is smoothed over by a
//     one-shot manual FLIP: snapshot each widget's current visual box
//     right before committing, then once its real post-commit box is
//     measured in onLayout, set its slot offset to (old - new) and spring
//     it back to (0, 0).
//   - We don't use React Native's LayoutAnimation for any of this. On the
//     New Architecture (Fabric) its "update" transition is unreliable (RN
//     #47617, #38661) — in some builds it silently no-ops regardless of
//     the configured duration. Worse, if react-native-reanimated is
//     anywhere in the dependency tree, it nulls out the UIManager's
//     animation delegate on init, which disables LayoutAnimation
//     completely. The Animated-based approach above runs on the native
//     driver and is unaffected by either gap.

import React, { useRef, useState, useCallback, useMemo, useEffect } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  type GestureResponderEvent,
} from "react-native"
import { useTheme } from "@shared/context/ThemeContext"
import type { ThemeColors } from "@shared/context/ThemeContext"
import type {
  WidgetDefinition,
  WidgetInstance,
  WidgetSize,
} from "@shared/types"

interface WidgetsPanelProps<T extends string> {
  widgets: WidgetInstance<T>[]
  isLoaded: boolean
  /** When false, widgets render as plain display cards — no drag handle,
   *  no remove button, and tapping doesn't cycle size. Turn on via the
   *  two-finger pull gesture or an explicit Edit toggle. */
  editMode: boolean
  onCycleSize: (id: string) => void
  onRemove: (id: string) => void
  onReorder: (orderedIds: string[]) => void
  renderContent: (instance: WidgetInstance<T>) => React.ReactNode
  /** This screen's widget-kind registry (icon, title, sizes, ...) — each
   *  screen hosting widgets owns its own registry, so it's passed in
   *  rather than imported from a single shared one. */
  registry: Record<T, WidgetDefinition<T>>
  /** Optional per-instance override for the whole card's background color
   *  (header row included, not just the content body). Return undefined
   *  to fall back to the default surface color. Use this instead of
   *  padding/margin tricks inside renderContent when a widget wants its
   *  icon/title row to visually belong to the same colored card as its
   *  content (e.g. an accent-colored "hero" widget). */
  getCardBackgroundColor?: (instance: WidgetInstance<T>) => string | undefined
  /** Optional per-instance override for the header row's icon/title/drag
   *  handle/remove-button text color, so it stays legible against a
   *  custom getCardBackgroundColor. Falls back to the default muted text
   *  color when omitted. */
  getHeaderTextColor?: (instance: WidgetInstance<T>) => string | undefined
  /** Optional per-instance raw style override, merged in last (after
   *  everything else, including getCardBackgroundColor) so it can win on
   *  any property. Intended for screens that want a group of widgets to
   *  visually fuse into one continuous card — e.g. zeroing out margin,
   *  border, and shadow, and setting only the outer corners' radius —
   *  without changing the shared default look every other screen gets.
   *  Return undefined for a widget that should keep the default card
   *  styling (its normal margin/border/shadow/radius). Screens typically
   *  gate this on their own edit-mode flag, returning undefined while
   *  editing so drag/resize affordances stay visible. */
  getCardStyleOverride?: (instance: WidgetInstance<T>) => object | undefined
  /** Optional background color for WidgetsPanel's own flex container (the
   *  row all widget cards sit inside). Left undefined, the container is
   *  transparent — the prior, default behavior.
   *
   *  Screens that fuse several widgets into what should read as one
   *  continuous card (via getCardStyleOverride) should pass the same
   *  color those widgets use for their own background here. Percentage-
   *  width siblings (e.g. two cards at 50% each) don't always sum to
   *  exactly the container's pixel width once Yoga rounds each one
   *  independently, which leaves a hairline gap between them. Painting
   *  the container the same color as the widgets means that gap — however
   *  big it ends up being on a given device — reveals more of the same
   *  color instead of a visible seam. Cheaper and more reliable than
   *  trying to force pixel-perfect widths. */
  containerBackgroundColor?: string
  /** Optional corner radius for WidgetsPanel's own flex container.
   *
   *  This MUST match whatever outer-corner radius the fused widgets
   *  themselves use (e.g. WIDGET_GROUP_RADIUS in the consuming screen),
   *  or the rounding on the widgets' own corners will be invisible: the
   *  container sits behind the whole group and, once
   *  containerBackgroundColor is set to the same color as the widgets,
   *  a square container corner peeking out from behind a rounded widget
   *  corner is indistinguishable from no rounding at all — same color
   *  on top of same color reads as one flat rectangle either way.
   *  Setting both `borderRadius` and `overflow: "hidden"` here clips the
   *  container itself to match, so the group's outer corners round for
   *  real instead of just on the (invisible) widget layer.
   *
   *  Left undefined, the container has no radius (prior, default
   *  behavior) — fine for screens that don't fuse widgets together. */
  containerBorderRadius?: number
}

const WIDTH_BY_SIZE: Record<WidgetSize, "48%" | "100%"> = {
  small: "48%",
  medium: "100%",
  large: "100%",
}

type LayoutBox = { x: number; y: number; width: number; height: number }

export default function WidgetsPanel<T extends string>({
  widgets,
  isLoaded,
  editMode,
  onCycleSize,
  onRemove,
  onReorder,
  renderContent,
  registry,
  getCardBackgroundColor,
  getHeaderTextColor,
  getCardStyleOverride,
  containerBackgroundColor,
  containerBorderRadius,
}: WidgetsPanelProps<T>): React.JSX.Element | null {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  // Live order shown on screen. Mirrors `widgets` except mid-drag, when we
  // own it locally for smooth reordering before committing.
  const [orderIds, setOrderIds] = useState<string[]>(() =>
    widgets.map((w) => w.id),
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Refs mirror the latest props/state so the PanResponder callbacks
  // (created once per widget id and never rebuilt) always see fresh data
  // instead of a stale closure from whichever render created them.
  const widgetsRef = useRef(widgets)
  widgetsRef.current = widgets
  const orderIdsRef = useRef(orderIds)
  orderIdsRef.current = orderIds
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder
  const draggingIdRef = useRef<string | null>(null)
  draggingIdRef.current = draggingId

  const widgetsById = useMemo(() => {
    const map = new Map<string, WidgetInstance<T>>()
    widgets.forEach((w) => map.set(w.id, w))
    return map
  }, [widgets])

  // Reconcile local order with parent-driven changes (add/remove) whenever
  // they happen outside of an active drag.
  const widgetsKey = widgets.map((w) => w.id).join("|")
  const prevWidgetsKeyRef = useRef(widgetsKey)
  if (prevWidgetsKeyRef.current !== widgetsKey && !draggingId) {
    prevWidgetsKeyRef.current = widgetsKey
    const next = widgets.map((w) => w.id)
    if (next.join("|") !== orderIds.join("|")) {
      setOrderIds(next)
    }
  }

  const layoutsRef = useRef<Map<string, LayoutBox>>(new Map())
  const dragStartLayoutRef = useRef<LayoutBox | null>(null)
  // Snapshot of every widget's box, taken once when a drag begins and never
  // updated until the drag ends. Hit-testing (findTargetIndex) and the
  // simulated reorder (retargetSlots) both read from this frozen copy, not
  // the live `layoutsRef`. If they read the live boxes instead, swapping
  // the dragged widget into a neighbor's slot would move that neighbor's
  // box out from under the pointer on the very next frame, which un-swaps
  // it, which moves the box back under the pointer, which re-swaps it — an
  // oscillation that shows up as the widget jittering up and down instead
  // of settling into place. Freezing the grid for the duration of the
  // gesture breaks that feedback loop entirely: which slot counts as
  // "under the finger" no longer depends on the outcome of the last swap,
  // and where a widget visually slides to no longer depends on a real
  // relayout that hasn't happened yet.
  const dragGridSnapshotRef = useRef<Map<string, LayoutBox>>(new Map())
  // Same frozen moment, but as an array of boxes indexed by *position* in
  // the pre-drag order (rather than by id). retargetSlots uses this to ask
  // "what box does slot i occupy under the original layout?" so it can
  // move whichever widget now logically sits at position i toward that
  // box, without waiting for Yoga to actually place it there.
  const dragSlotBoxesRef = useRef<LayoutBox[]>([])
  const dragOrderRef = useRef<string[]>(orderIds)
  const pan = useRef(new Animated.ValueXY()).current
  const liftAnim = useRef(new Animated.Value(1)).current

  // ─── Per-widget slot animation (manual FLIP, replaces LayoutAnimation) ──
  // One Animated.ValueXY per widget id, applied as a translate on top of
  // its normal flex position. At rest it's always {0, 0}.
  const slotAnimsRef = useRef<Map<string, Animated.ValueXY>>(new Map())
  // Mirrors each slot anim's current value on the JS side (kept in sync via
  // a listener) so retargetSlots/reflow-on-release can read "where is this
  // widget actually drawn right now" synchronously, without waiting on the
  // native driver.
  const slotAnimValuesRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  )
  // Boxes captured at the moment a reorder is committed, keyed by widget
  // id, representing where that widget was visually drawn *before* the
  // commit. Consumed (and removed) by handleLayout once that widget's new
  // post-commit box is measured, which is what kicks off its FLIP spring.
  const pendingFlipRef = useRef<Map<string, LayoutBox>>(new Map())

  const getSlotAnim = useCallback((id: string): Animated.ValueXY => {
    let anim = slotAnimsRef.current.get(id)
    if (anim) return anim
    anim = new Animated.ValueXY({ x: 0, y: 0 })
    slotAnimValuesRef.current.set(id, { x: 0, y: 0 })
    anim.addListener((value) => {
      slotAnimValuesRef.current.set(id, value)
    })
    slotAnimsRef.current.set(id, anim)
    return anim
  }, [])

  // Prune slot anims for widgets that no longer exist so we don't leak
  // listeners/Animated.Value instances as widgets get removed over time.
  useEffect(() => {
    const currentIds = new Set(widgets.map((w) => w.id))
    slotAnimsRef.current.forEach((anim, id) => {
      if (currentIds.has(id)) return
      anim.stopAnimation()
      anim.removeAllListeners()
      slotAnimsRef.current.delete(id)
      slotAnimValuesRef.current.delete(id)
      pendingFlipRef.current.delete(id)
    })
  }, [widgets])

  const handleLayout = useCallback(
    (id: string, e: LayoutChangeEvent) => {
      const { x, y, width, height } = e.nativeEvent.layout
      const newBox: LayoutBox = { x, y, width, height }
      layoutsRef.current.set(id, newBox)

      // The actively-dragged widget's placeholder is invisible and tracked
      // by the floating overlay instead — it never needs a slot FLIP.
      if (id === draggingIdRef.current) return

      const oldBox = pendingFlipRef.current.get(id)
      if (!oldBox) return
      pendingFlipRef.current.delete(id)

      const dx = oldBox.x - newBox.x
      const dy = oldBox.y - newBox.y
      if (dx === 0 && dy === 0) return

      const anim = getSlotAnim(id)
      anim.stopAnimation()
      anim.setValue({ x: dx, y: dy })
      Animated.spring(anim, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        friction: 8,
        tension: 65,
      }).start()
    },
    [getSlotAnim],
  )

  // Purely visual reorder simulation, called on every hover-crossing during
  // a drag. Moves every affected widget (via its slot Animated.ValueXY)
  // toward the frozen box that its new logical position would occupy.
  // Deliberately does NOT touch `orderIds`/React state — see the header
  // comment for why committing the real order on every crossing is what
  // causes the jitter this replaces.
  const retargetSlots = useCallback(
    (next: string[]) => {
      const dragged = draggingIdRef.current
      const slots = dragSlotBoxesRef.current
      next.forEach((id, index) => {
        if (id === dragged) return
        const home = dragGridSnapshotRef.current.get(id)
        const slot = slots[index]
        if (!home || !slot) return
        const anim = getSlotAnim(id)
        Animated.spring(anim, {
          toValue: { x: slot.x - home.x, y: slot.y - home.y },
          useNativeDriver: true,
          friction: 8,
          tension: 65,
        }).start()
      })
    },
    [getSlotAnim],
  )

  // Springs every widget's slot offset back to rest. Used when a drag ends
  // without a real commit (terminated) so widgets that were visually
  // retargeted mid-drag don't get stranded off their true flex position.
  const resetSlots = useCallback((ids: string[], exceptId: string) => {
    ids.forEach((id) => {
      if (id === exceptId) return
      const anim = slotAnimsRef.current.get(id)
      if (!anim) return
      Animated.spring(anim, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        friction: 8,
        tension: 65,
      }).start()
    })
  }, [])

  // Which slot is the drag point currently over? A hit only counts once the
  // point is well inside a box (not just grazing the edge) — this hysteresis
  // margin stops the target from flapping between two adjacent slots when
  // the finger hovers near their shared boundary.
  const HIT_MARGIN = 14
  const findTargetIndex = useCallback(
    (draggedId: string, pointX: number, pointY: number): number => {
      const order = dragOrderRef.current
      const currentIndex = order.indexOf(draggedId)
      let best = currentIndex
      let bestDist = Infinity
      order.forEach((id, index) => {
        if (id === draggedId) return
        const box = dragGridSnapshotRef.current.get(id)
        if (!box) return
        const inside =
          pointX >= box.x + HIT_MARGIN &&
          pointX <= box.x + box.width - HIT_MARGIN &&
          pointY >= box.y + HIT_MARGIN &&
          pointY <= box.y + box.height - HIT_MARGIN
        if (!inside) return
        const bx = box.x + box.width / 2
        const by = box.y + box.height / 2
        const dist = Math.hypot(bx - pointX, by - pointY)
        if (dist < bestDist) {
          bestDist = dist
          best = index
        }
      })
      return best
    },
    [],
  )

  const respondersRef = useRef<
    Map<string, ReturnType<typeof PanResponder.create>>
  >(new Map())

  const getResponderFor = useCallback(
    (id: string) => {
      const existing = respondersRef.current.get(id)
      if (existing) return existing

      const created = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const box = layoutsRef.current.get(id)
          dragStartLayoutRef.current = box ?? null
          dragOrderRef.current = orderIdsRef.current
          dragGridSnapshotRef.current = new Map(layoutsRef.current)
          dragSlotBoxesRef.current = orderIdsRef.current
            .map((wid) => layoutsRef.current.get(wid))
            .filter((b): b is LayoutBox => !!b)
          pan.setValue({ x: 0, y: 0 })
          setDraggingId(id)
          Animated.spring(liftAnim, {
            toValue: 1.05,
            useNativeDriver: true,
            friction: 7,
            tension: 60,
          }).start()
        },
        // The transform itself runs on the native thread (useNativeDriver)
        // so the widget tracks the finger at full frame rate with no JS
        // bridge lag. The `listener` still gets gestureState on the JS
        // side, which is all our hit-testing for reordering needs.
        onPanResponderMove: (
          _evt: GestureResponderEvent,
          gestureState: PanResponderGestureState,
        ) => {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy })

          const start = dragStartLayoutRef.current
          if (!start) return
          const pointX = start.x + start.width / 2 + gestureState.dx
          const pointY = start.y + start.height / 2 + gestureState.dy
          const targetIndex = findTargetIndex(id, pointX, pointY)
          const current = dragOrderRef.current
          const fromIndex = current.indexOf(id)
          if (targetIndex !== -1 && targetIndex !== fromIndex) {
            const next = [...current]
            next.splice(fromIndex, 1)
            next.splice(targetIndex, 0, id)
            // Logical order only — no setOrderIds here. The real relayout
            // is deferred to release so it happens exactly once per
            // gesture instead of once per crossing.
            dragOrderRef.current = next
            retargetSlots(next)
          }
        },
        onPanResponderRelease: () => {
          const finalOrder = dragOrderRef.current
          const changed = finalOrder.join("|") !== orderIdsRef.current.join("|")

          if (changed) {
            // "First": snapshot every non-dragged widget's current visual
            // box (frozen home box + whatever slot offset retargetSlots
            // left it at) so the FLIP in handleLayout animates from where
            // things actually are on screen, not from a stale position.
            finalOrder.forEach((wid) => {
              if (wid === id) return
              const home = dragGridSnapshotRef.current.get(wid)
              if (!home) return
              const offset = slotAnimValuesRef.current.get(wid) ?? {
                x: 0,
                y: 0,
              }
              pendingFlipRef.current.set(wid, {
                x: home.x + offset.x,
                y: home.y + offset.y,
                width: home.width,
                height: home.height,
              })
            })
            // "Last": commit the real order. This is the single relayout
            // for the whole gesture.
            setOrderIds(finalOrder)
          }

          // Animate the floating overlay to wherever this widget will
          // actually land. We can't read its real post-commit box yet
          // (setOrderIds above hasn't relaid-out synchronously), so we use
          // the same frozen slot geometry retargetSlots used throughout the
          // drag — it's already been the source of truth for this widget's
          // visual position the whole time, so there's no jump when the
          // placeholder takes over from the overlay.
          const start = dragStartLayoutRef.current
          const finalIndex = finalOrder.indexOf(id)
          const targetSlot = dragSlotBoxesRef.current[finalIndex]
          const targetOffset =
            start && targetSlot
              ? { x: targetSlot.x - start.x, y: targetSlot.y - start.y }
              : { x: 0, y: 0 }

          Animated.parallel([
            Animated.spring(pan, {
              toValue: targetOffset,
              useNativeDriver: true,
              friction: 9,
              tension: 70,
            }),
            Animated.spring(liftAnim, {
              toValue: 1,
              useNativeDriver: true,
              friction: 7,
              tension: 60,
            }),
          ]).start(() => {
            setDraggingId(null)
            dragStartLayoutRef.current = null
            pan.setValue({ x: 0, y: 0 })
          })

          if (changed) {
            onReorderRef.current(finalOrder)
          }
        },
        onPanResponderTerminate: () => {
          // The drag never committed, so any widgets that were visually
          // retargeted mid-drag need to spring back to their real (never
          // actually moved) flex position instead of staying stranded.
          resetSlots(dragOrderRef.current, id)
          pan.setValue({ x: 0, y: 0 })
          liftAnim.setValue(1)
          setDraggingId(null)
          dragStartLayoutRef.current = null
        },
      })

      respondersRef.current.set(id, created)
      return created
    },
    [findTargetIndex, retargetSlots, resetSlots, pan, liftAnim],
  )

  if (!isLoaded) return null
  if (widgets.length === 0) return null

  const ordered = orderIds
    .map((id) => widgetsById.get(id))
    .filter((w): w is WidgetInstance<T> => !!w)

  const draggingInstance = draggingId ? widgetsById.get(draggingId) : null
  const draggingDef = draggingInstance ? registry[draggingInstance.type] : null
  const startBox = dragStartLayoutRef.current

  return (
    <View
      style={[
        styles.container,
        containerBackgroundColor
          ? { backgroundColor: containerBackgroundColor }
          : null,
        containerBorderRadius != null
          ? { borderRadius: containerBorderRadius, overflow: "hidden" }
          : null,
      ]}
    >
      {ordered.map((instance) => {
        const def = registry[instance.type]
        if (!def) return null
        const isDragging = draggingId === instance.id
        const responder = getResponderFor(instance.id)
        const slotAnim = getSlotAnim(instance.id)
        const bgOverride = getCardBackgroundColor?.(instance)
        const headerTextOverride = getHeaderTextColor?.(instance)
        const styleOverride = getCardStyleOverride?.(instance)

        const cardStyle = [
          styles.widget,
          { width: WIDTH_BY_SIZE[instance.size] },
          editMode && styles.widgetEditing,
          isDragging && styles.widgetHiddenPlaceholder,
          { transform: slotAnim.getTranslateTransform() },
          bgOverride ? { backgroundColor: bgOverride } : null,
          styleOverride ?? null,
        ]

        const inner = (
          <>
            <View style={styles.widgetHeader}>
              {def.icon && (
                <Text
                  style={[
                    styles.widgetIcon,
                    headerTextOverride && { color: headerTextOverride },
                  ]}
                >
                  {def.icon}
                </Text>
              )}
              {def.title && (
                <Text
                  style={[
                    styles.widgetTitle,
                    headerTextOverride && { color: headerTextOverride },
                  ]}
                  numberOfLines={1}
                >
                  {def.title}
                </Text>
              )}
              <View style={styles.headerSpacer} />
              {editMode && (
                <>
                  <View
                    {...responder.panHandlers}
                    style={styles.dragHandle}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.dragHandleText,
                        headerTextOverride && { color: headerTextOverride },
                      ]}
                    >
                      ⠿
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onRemove(instance.id)}
                    hitSlop={8}
                    style={styles.removeButton}
                  >
                    <Text
                      style={[
                        styles.removeButtonText,
                        headerTextOverride && { color: headerTextOverride },
                      ]}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <View style={styles.widgetBody}>{renderContent(instance)}</View>
          </>
        )

        return (
          <Animated.View
            key={instance.id}
            onLayout={(e) => handleLayout(instance.id, e)}
            style={cardStyle}
          >
            {editMode ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onCycleSize(instance.id)}
              >
                {inner}
              </TouchableOpacity>
            ) : (
              inner
            )}
          </Animated.View>
        )
      })}

      {draggingInstance && draggingDef && startBox && (
        <Animated.View
          pointerEvents='none'
          style={[
            styles.widget,
            styles.floatingWidget,
            {
              width: WIDTH_BY_SIZE[draggingInstance.size],
              left: startBox.x,
              top: startBox.y,
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { scale: liftAnim },
              ],
            },
            (() => {
              const bg = getCardBackgroundColor?.(draggingInstance)
              return bg ? { backgroundColor: bg } : null
            })(),
          ]}
        >
          <View style={styles.widgetHeader}>
            {draggingDef.icon && (
              <Text
                style={[
                  styles.widgetIcon,
                  (() => {
                    const c = getHeaderTextColor?.(draggingInstance)
                    return c ? { color: c } : null
                  })(),
                ]}
              >
                {draggingDef.icon}
              </Text>
            )}
            {draggingDef.title && (
              <Text
                style={[
                  styles.widgetTitle,
                  (() => {
                    const c = getHeaderTextColor?.(draggingInstance)
                    return c ? { color: c } : null
                  })(),
                ]}
                numberOfLines={1}
              >
                {draggingDef.title}
              </Text>
            )}
            <View style={styles.headerSpacer} />
            <View style={styles.dragHandle}>
              <Text
                style={[
                  styles.dragHandleText,
                  (() => {
                    const c = getHeaderTextColor?.(draggingInstance)
                    return c ? { color: c } : null
                  })(),
                ]}
              >
                ⠿
              </Text>
            </View>
          </View>
          <View style={styles.widgetBody}>
            {renderContent(draggingInstance)}
          </View>
        </Animated.View>
      )}
    </View>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginBottom: 20,
      position: "relative",
    },
    widget: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      minHeight: 70,
    },
    widgetEditing: {
      borderColor: colors.accent,
      borderStyle: "dashed",
    },
    widgetHiddenPlaceholder: {
      opacity: 0,
    },
    floatingWidget: {
      position: "absolute",
      zIndex: 50,
      elevation: 8,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    widgetHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    widgetIcon: {
      fontSize: 16,
      marginRight: 6,
    },
    widgetTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
      flexShrink: 1,
    },
    headerSpacer: {
      flex: 1,
    },
    dragHandle: {
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    dragHandleText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    removeButton: {
      marginLeft: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    removeButtonText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    widgetBody: {
      flexGrow: 1,
    },
  })
