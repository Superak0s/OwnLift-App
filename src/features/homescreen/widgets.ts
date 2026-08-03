// src/features/home/widgets.ts
//
// Home-screen-specific widget config. The widget *placement/drag* system
// (WidgetsPanel, WidgetGallery, useWidgets) is shared across every screen
// that hosts widgets, but the actual set of widgets — their type union,
// copy, icons, default sizes, and starting layout — is owned per screen.
// A different screen (e.g. features/tracking/widgets.ts) defines its own
// HomeWidgetType-shaped union, its own registry, its own defaults, and its
// own storage key, and wires them into useWidgets/WidgetsPanel the same way
// HomeScreen does with these.

import { STORAGE_KEYS } from "@shared/services/storage"
import type { WidgetDefinition, WidgetInstance } from "@shared/types"

export type HomeWidgetType =
  | "next_workout"
  | "weekly_progress"
  | "workout_calendar"
  | "getting_started"
  | "body_weight_trend"
  | "supplement_reminders"
  | "recent_prs"
  | "workout_streak"

export const HOME_WIDGET_REGISTRY: Record<
  HomeWidgetType,
  WidgetDefinition<HomeWidgetType>
> = {
  next_workout: {
    type: "next_workout",
    title: "Next Workout",
    description:
      "Today's day, lock status, and quick actions to change day or start",
    icon: "🏋️",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  weekly_progress: {
    type: "weekly_progress",
    title: "Weekly Progress",
    description: "Days completed and locked this week",
    icon: "📊",
    availableSizes: ["small", "medium"],
    defaultSize: "small",
    singleton: true,
  },
  workout_calendar: {
    type: "workout_calendar",
    title: "Workout History",
    description:
      "Calendar view of past workout sessions — tap a day to see details",
    icon: "📅",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  getting_started: {
    type: "getting_started",
    title: "Getting Started",
    description: "Quick steps for setting up and running your first workout",
    icon: "📝",
    availableSizes: ["small", "medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  body_weight_trend: {
    type: "body_weight_trend",
    title: "Body Weight Trend",
    description: "Recent weigh-ins as a mini chart",
    icon: "⚖️",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  supplement_reminders: {
    type: "supplement_reminders",
    title: "Supplements Today",
    description: "Today's supplement doses and quick-log",
    icon: "💊",
    availableSizes: ["small", "medium"],
    defaultSize: "small",
    singleton: true,
  },
  recent_prs: {
    type: "recent_prs",
    title: "Recent PRs",
    description: "Your latest personal bests",
    icon: "🏆",
    availableSizes: ["small", "medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  workout_streak: {
    type: "workout_streak",
    title: "Streak",
    description: "Consecutive weeks with a completed day",
    icon: "🔥",
    availableSizes: ["small"],
    defaultSize: "small",
    singleton: true,
  },
}

export const DEFAULT_HOME_WIDGETS: WidgetInstance<HomeWidgetType>[] = [
  {
    id: "default-next-workout",
    type: "next_workout",
    size: "large",
    order: 0,
  },
  {
    id: "default-workout-calendar",
    type: "workout_calendar",
    size: "large",
    order: 1,
  },
  {
    id: "default-weekly-progress",
    type: "weekly_progress",
    size: "small",
    order: 2,
  },
  {
    id: "default-supplement-reminders",
    type: "supplement_reminders",
    size: "small",
    order: 3,
  },
]

export const HOME_WIDGETS_STORAGE_KEY = STORAGE_KEYS.HOME_WIDGETS
