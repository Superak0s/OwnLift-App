// src/features/analytics/widgets.ts

import { STORAGE_KEYS } from "@shared/services/storage"
import type { WidgetDefinition, WidgetInstance } from "@shared/types"

export type AnalyticsWidgetType =
  | "select_exercise"
  | "set_data"
  | "last_workout"
  | "workout_history"
  | "weight_progress"
  | "volume_progress"
  | "reps_progress"

export const ANALYTICS_WIDGET_REGISTRY: Record<
  AnalyticsWidgetType,
  WidgetDefinition<AnalyticsWidgetType>
> = {
  select_exercise: {
    type: "select_exercise",
    title: "Select Exercise",
    description: "Pick which exercise to analyze, with search and filters",
    icon: "🏋️",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  set_data: {
    type: "set_data",
    title: "All Set Data",
    description:
      "Total sets, workouts, max weight/reps, and averages for the selected exercise",
    icon: "📊",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  last_workout: {
    type: "last_workout",
    title: "Last Workout",
    description: "The most recent date you trained this exercise",
    icon: "🕐",
    availableSizes: ["small", "medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  workout_history: {
    type: "workout_history",
    title: "Workout History",
    description: "Calendar view of past sets for this exercise",
    icon: "📅",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  weight_progress: {
    type: "weight_progress",
    description: "Weight trend over time for the selected exercise",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  volume_progress: {
    type: "volume_progress",
    description: "Total volume (weight × reps) trend over time",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  reps_progress: {
    type: "reps_progress",
    description: "Average reps per session trend over time",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
}

export const DEFAULT_ANALYTICS_WIDGETS: WidgetInstance<AnalyticsWidgetType>[] =
  [
    {
      id: "default-select-exercise",
      type: "select_exercise",
      size: "large",
      order: 0,
    },
    {
      id: "default-set-data",
      type: "set_data",
      size: "large",
      order: 1,
    },
    {
      id: "default-last-workout",
      type: "last_workout",
      size: "medium",
      order: 2,
    },
    {
      id: "default-workout-history",
      type: "workout_history",
      size: "large",
      order: 3,
    },
    {
      id: "default-volume-progress",
      type: "volume_progress",
      size: "large",
      order: 4,
    },
    {
      id: "default-weight-progress",
      type: "weight_progress",
      size: "large",
      order: 5,
    },
    {
      id: "default-reps-progress",
      type: "reps_progress",
      size: "large",
      order: 6,
    },
  ]

export const ANALYTICS_WIDGETS_STORAGE_KEY = STORAGE_KEYS.ANALYTICS_WIDGETS
