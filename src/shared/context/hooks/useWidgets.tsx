// src/shared/context/hooks/useWidgets.tsx
//
// Renamed from useHomeWidgets -> useWidgets (it's a generic "place widgets
// on a screen" hook, not something tied specifically to Home).
//
// BUG FIX: this hook was never imported/rendered anywhere in the app, so
// the whole widget feature was dead code. See WidgetsPanel.tsx +
// WidgetGallery.tsx + the updated HomeScreen.tsx for the wiring that makes
// it actually show up and actually work.
import { useState, useEffect, useCallback, useRef } from "react"
import { saveToStorage, loadFromStorage } from "@shared/services/storage"
import type {
  WidgetInstance,
  WidgetSize,
  WidgetDefinition,
} from "@shared/types"

const generateWidgetId = <T extends string>(type: T) =>
  `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

function sortByOrder<T extends string>(
  list: WidgetInstance<T>[],
): WidgetInstance<T>[] {
  return [...list].sort((a, b) => a.order - b.order)
}

/**
 * Generic "place widgets on a screen" hook. Each screen supplies its own
 * widget-type union (via `T`), registry, defaults, and storage key — see
 * e.g. features/home/widgets.ts — so the same hook backs the Home screen's
 * widgets, the Tracking screen's widgets, etc. without them stepping on
 * each other's storage or type space.
 */
export interface UseWidgetsConfig<T extends string> {
  registry: Record<T, WidgetDefinition<T>>
  defaults: WidgetInstance<T>[]
  /** Storage key this screen's widget layout is persisted under. */
  storageKey: string
}

export function useWidgets<T extends string>(
  userId: string | null,
  { registry, defaults, storageKey }: UseWidgetsConfig<T>,
) {
  const [widgets, setWidgets] = useState<WidgetInstance<T>[]>([])
  const [isLoaded, setIsLoaded] = useState<boolean>(false)
  const isMountedRef = useRef<boolean>(true)
  // Keep a ref mirror of widgets so callbacks that must be stable
  // (e.g. things fired from a gesture handler) always see the latest
  // list instead of a stale closure captured at mount time.
  const widgetsRef = useRef<WidgetInstance<T>[]>([])

  useEffect(() => {
    widgetsRef.current = widgets
  }, [widgets])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // (Re)load whenever the active user (or the screen's storage key) changes
  useEffect(() => {
    let cancelled = false
    setIsLoaded(false)
    ;(async () => {
      try {
        const stored = await loadFromStorage<WidgetInstance<T>[]>(
          storageKey,
          userId,
        )
        if (cancelled) return
        setWidgets(stored && stored.length > 0 ? sortByOrder(stored) : defaults)
      } catch (error) {
        console.error("Error loading widgets:", error)
        if (!cancelled) setWidgets(defaults)
      } finally {
        if (!cancelled) setIsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, storageKey, defaults])

  const persist = useCallback(
    async (next: WidgetInstance<T>[]) => {
      if (!isMountedRef.current) return
      setWidgets(next)
      widgetsRef.current = next
      try {
        await saveToStorage(storageKey, next, userId)
      } catch (error) {
        console.error("Error saving widgets:", error)
      }
    },
    [userId, storageKey],
  )

  const addWidget = useCallback(
    async (type: T): Promise<{ success: boolean; error?: string }> => {
      const def = registry[type]
      if (!def) return { success: false, error: "Unknown widget type" }

      const current = widgetsRef.current
      if (def.singleton && current.some((w) => w.type === type)) {
        return {
          success: false,
          error: `${def.title} is already on your home screen`,
        }
      }

      const instance: WidgetInstance<T> = {
        id: generateWidgetId(type),
        type,
        size: def.defaultSize,
        order: current.length,
      }

      await persist([...current, instance])
      return { success: true }
    },
    [persist, registry],
  )

  const removeWidget = useCallback(
    async (id: string) => {
      const next = widgetsRef.current
        .filter((w) => w.id !== id)
        .map((w, index) => ({ ...w, order: index }))
      await persist(next)
    },
    [persist],
  )

  const cycleWidgetSize = useCallback(
    async (id: string) => {
      const current = widgetsRef.current
      const target = current.find((w) => w.id === id)
      if (!target) return
      const def = registry[target.type]
      const options = def.availableSizes
      if (options.length <= 1) return

      const currentIndex = options.indexOf(target.size)
      const nextSize = options[(currentIndex + 1) % options.length]

      await persist(
        current.map((w) => (w.id === id ? { ...w, size: nextSize } : w)),
      )
    },
    [persist, registry],
  )

  const setWidgetSize = useCallback(
    async (id: string, size: WidgetSize) => {
      await persist(
        widgetsRef.current.map((w) => (w.id === id ? { ...w, size } : w)),
      )
    },
    [persist],
  )

  const moveWidget = useCallback(
    async (id: string, direction: "up" | "down") => {
      const sorted = sortByOrder(widgetsRef.current)
      const index = sorted.findIndex((w) => w.id === id)
      if (index === -1) return
      const swapWith = direction === "up" ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= sorted.length) return

      const next = [...sorted]
      ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
      await persist(next.map((w, i) => ({ ...w, order: i })))
    },
    [persist],
  )

  const reorderWidgets = useCallback(
    async (orderedIds: string[]) => {
      const byId = new Map(widgetsRef.current.map((w) => [w.id, w]))
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((w): w is WidgetInstance<T> => !!w)
        .map((w, index) => ({ ...w, order: index }))
      await persist(next)
    },
    [persist],
  )

  const resetToDefault = useCallback(async () => {
    await persist(defaults)
  }, [persist, defaults])

  const clearAllWidgets = useCallback(async () => {
    await persist([])
  }, [persist])

  const availableToAdd: WidgetDefinition<T>[] = (
    Object.values(registry) as WidgetDefinition<T>[]
  ).filter(
    (def) => !(def.singleton && widgets.some((w) => w.type === def.type)),
  )

  return {
    widgets: sortByOrder(widgets),
    isLoaded,
    availableToAdd,
    addWidget,
    removeWidget,
    cycleWidgetSize,
    setWidgetSize,
    moveWidget,
    reorderWidgets,
    resetToDefault,
    clearAllWidgets,
  }
}
