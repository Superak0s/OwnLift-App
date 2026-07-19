// src/features/plan/widgets.ts
//
// Plan-screen-specific widget config. The widget *placement/drag* system
// (WidgetsPanel, WidgetGallery, useWidgets) is shared across every screen
// that hosts widgets, but the actual set of widgets — their type union,
// copy, icons, default sizes, and starting layout — is owned per screen.
// See features/home/widgets.ts for the sibling registry HomeScreen uses;
// this one is wired into PlanScreen the same way.

import { STORAGE_KEYS } from "@shared/services/storage"
import type { WidgetDefinition, WidgetInstance } from "@shared/types"

export type PlanWidgetType =
  | "create_split"
  | "import_workout"
  | "default_splits"
  | "workout_plan_loaded"
  | "select_split"
  | "view_program"

export const PLAN_WIDGET_REGISTRY: Record<
  PlanWidgetType,
  WidgetDefinition<PlanWidgetType>
> = {
  create_split: {
    type: "create_split",
    title: "Create New Split",
    description:
      "Build a custom split from scratch — name it, add days and muscle groups",
    icon: "➕",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  import_workout: {
    type: "import_workout",
    title: "Import New Workout",
    description:
      "Import a workout plan from a spreadsheet file (.ods, .xlsx, .xls)",
    icon: "📁",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  default_splits: {
    type: "default_splits",
    title: "Default Splits",
    description: "Quick-start templates — pick one to start a new program",
    icon: "🗂️",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  workout_plan_loaded: {
    type: "workout_plan_loaded",
    title: "Workout Plan Loaded",
    description:
      "Your active program at a glance — total days, splits, and export",
    icon: "📊",
    availableSizes: ["small", "medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  select_split: {
    type: "select_split",
    title: "Select Your Split",
    description: "Choose which split you're currently training",
    icon: "🎯",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  view_program: {
    type: "view_program",
    title: "View Program",
    description:
      "Browse and edit every day in your program, exercise by exercise",
    icon: "📋",
    availableSizes: ["large"],
    defaultSize: "large",
    singleton: true,
  },
}

export const DEFAULT_PLAN_WIDGETS: WidgetInstance<PlanWidgetType>[] = [
  {
    id: "default-create-split",
    type: "create_split",
    size: "large",
    order: 0,
  },
  {
    id: "default-import-workout",
    type: "import_workout",
    size: "medium",
    order: 1,
  },
  {
    id: "default-default-splits",
    type: "default_splits",
    size: "medium",
    order: 2,
  },
  {
    id: "default-workout-plan-loaded",
    type: "workout_plan_loaded",
    size: "medium",
    order: 3,
  },
  {
    id: "default-select-split",
    type: "select_split",
    size: "large",
    order: 4,
  },
  {
    id: "default-view-program",
    type: "view_program",
    size: "large",
    order: 5,
  },
]

// NOTE: add a `PLAN_WIDGETS` key to STORAGE_KEYS in @shared/services/storage
// (right next to HOME_WIDGETS) before wiring this in — e.g.
// `PLAN_WIDGETS: "plan_widgets"`.
export const PLAN_WIDGETS_STORAGE_KEY = STORAGE_KEYS.PLAN_WIDGETS
