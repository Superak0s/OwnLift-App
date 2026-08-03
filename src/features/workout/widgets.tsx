// src/features/Workout/widgets.ts
//
// Workout-screen-specific widget config for the WorkoutScreen header card.
// Same pattern as features/home/widgets.ts: the widget *placement/drag*
// system (WidgetsPanel, WidgetGallery, useWidgets) is shared, but the set
// of widgets — their type union, copy, icons, default sizes, and starting
// layout — is specific to this screen.
//
// Four widgets, laid out by default as one continuous "day status" area
// (see getWidgetCardStyleOverride in WorkoutScreen.tsx, which fuses them
// into a single seamless card outside of edit mode):
//   - day_number   (small, left half of row 1)
//   - total_sets   (small, right half of row 1)
//   - progress     (large/full-width, row 2)
//   - session_stats (medium/full-width, row 3 — total time, avg rest, and
//                    the rest reminder all in one line, plus the current
//                    rest timer underneath)
//
// total_time / avg_rest / rest_reminder used to be three separate small
// widgets, but three 48%-wide cards can only ever fit two per row — they're
// merged into one full-width widget so all three sit on a single line.

import { STORAGE_KEYS } from "@shared/services/storage"
import type { WidgetDefinition, WidgetInstance } from "@shared/types"

export type WorkoutWidgetType =
  | "day_number"
  | "total_sets"
  | "progress"
  | "session_stats"

export const WORKOUT_WIDGET_REGISTRY: Record<
  WorkoutWidgetType,
  WidgetDefinition<WorkoutWidgetType>
> = {
  day_number: {
    type: "day_number",
    title: "Day",
    description: "Current day number and lock status",
    icon: "📅",
    availableSizes: ["small"],
    defaultSize: "small",
    singleton: true,
  },
  total_sets: {
    type: "total_sets",
    title: "Total Sets",
    description: "Total sets scheduled for the day",
    icon: "🔢",
    availableSizes: ["small"],
    defaultSize: "small",
    singleton: true,
  },
  progress: {
    type: "progress",
    title: "Progress",
    description:
      "Sets completed, progress bar, estimated time remaining, and estimated finish time",
    icon: "📊",
    availableSizes: ["large"],
    defaultSize: "large",
    singleton: true,
  },
  session_stats: {
    type: "session_stats",
    title: "Session Stats",
    description:
      "Total session time, average rest per set, rest reminder, and current rest timer",
    icon: "⏱️",
    availableSizes: ["medium"],
    defaultSize: "medium",
    singleton: true,
  },
}

export const DEFAULT_WORKOUT_WIDGETS: WidgetInstance<WorkoutWidgetType>[] = [
  { id: "default-day-number", type: "day_number", size: "small", order: 0 },
  { id: "default-total-sets", type: "total_sets", size: "small", order: 1 },
  { id: "default-progress", type: "progress", size: "large", order: 2 },
  {
    id: "default-session-stats",
    type: "session_stats",
    size: "medium",
    order: 3,
  },
]

export const WORKOUT_WIDGETS_STORAGE_KEY = STORAGE_KEYS.WORKOUT_WIDGETS
