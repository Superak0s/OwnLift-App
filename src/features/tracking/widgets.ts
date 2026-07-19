// src/features/tracking/widgets.ts
//
// Tracking-screen widget config. Unlike Home (one widget board for the
// whole screen), Tracking keeps its four tabs — Weight / Photos / Macros /
// Body Fat — and each tab is its own independent, add/remove/resize/
// reorder widget board, using the same shared WidgetsPanel/WidgetGallery/
// useWidgets machinery as Home, just instantiated once per tab.
//
// That means four separate widget-type unions, four registries, four
// default layouts, and four storage keys — one per tab — rather than one
// combined set.

import { STORAGE_KEYS } from "@shared/services/storage"
import type { WidgetDefinition, WidgetInstance } from "@shared/types"

export const TRACKING_TABS = [
  { key: "weight", icon: "⚖️", label: "Weight" },
  { key: "photos", icon: "📸", label: "Photos" },
  { key: "macros", icon: "🥗", label: "Macros" },
  { key: "bodyfat", icon: "📐", label: "Body Fat" },
]

// ─── Weight tab ────────────────────────────────────────────────────────────

export type WeightWidgetType =
  | "weight_overview"
  | "weight_calendar"
  | "weight_history"
  | "weight_chart"

export const WEIGHT_WIDGET_REGISTRY: Record<
  WeightWidgetType,
  WidgetDefinition<WeightWidgetType>
> = {
  weight_overview: {
    type: "weight_overview",
    title: "Current Weight",
    description: "Latest weigh-in, trend vs. average, and a quick log button",
    icon: "⚖️",
    availableSizes: ["small", "medium"],
    defaultSize: "medium",
    singleton: true,
  },
  weight_calendar: {
    type: "weight_calendar",
    title: "Weight Calendar",
    description: "Calendar view of days you've logged weight",
    icon: "📅",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  weight_history: {
    type: "weight_history",
    title: "Weight History",
    description: "Your recent weight entries, with delete and load-more",
    icon: "📋",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  weight_chart: {
    type: "weight_chart",
    title: "Weight Trend Chart",
    description: "Line chart of your weight over time",
    icon: "📈",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
}

export const DEFAULT_WEIGHT_WIDGETS: WidgetInstance<WeightWidgetType>[] = [
  {
    id: "default-weight-overview",
    type: "weight_overview",
    size: "medium",
    order: 0,
  },
  {
    id: "default-weight-calendar",
    type: "weight_calendar",
    size: "large",
    order: 1,
  },
  {
    id: "default-weight-history",
    type: "weight_history",
    size: "medium",
    order: 2,
  },
  {
    id: "default-weight-chart",
    type: "weight_chart",
    size: "medium",
    order: 3,
  },
]

export const WEIGHT_WIDGETS_STORAGE_KEY = STORAGE_KEYS.WEIGHT_TAB_WIDGETS

// ─── Photos tab ─────────────────────────────────────────────────────────────

export type PhotosWidgetType = "photos_calendar" | "photos_gallery"

export const PHOTOS_WIDGET_REGISTRY: Record<
  PhotosWidgetType,
  WidgetDefinition<PhotosWidgetType>
> = {
  photos_calendar: {
    type: "photos_calendar",
    title: "Photos Calendar",
    description: "Calendar view of days you've taken progress photos",
    icon: "📅",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  photos_gallery: {
    type: "photos_gallery",
    title: "Progress Photos",
    description: "Recent progress photos grouped by day, with quick capture",
    icon: "📸",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
}

export const DEFAULT_PHOTOS_WIDGETS: WidgetInstance<PhotosWidgetType>[] = [
  {
    id: "default-photos-calendar",
    type: "photos_calendar",
    size: "large",
    order: 0,
  },
  {
    id: "default-photos-gallery",
    type: "photos_gallery",
    size: "large",
    order: 1,
  },
]

export const PHOTOS_WIDGETS_STORAGE_KEY = STORAGE_KEYS.PHOTOS_TAB_WIDGETS

// ─── Macros tab ─────────────────────────────────────────────────────────────

export type MacrosWidgetType = "macros_calendar" | "macros_today"

export const MACROS_WIDGET_REGISTRY: Record<
  MacrosWidgetType,
  WidgetDefinition<MacrosWidgetType>
> = {
  macros_calendar: {
    type: "macros_calendar",
    title: "Macros Calendar",
    description: "Calendar view of days you've logged macros",
    icon: "📅",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  macros_today: {
    type: "macros_today",
    title: "Today's Macros",
    description: "Today's nutrition intake vs. your goals, with quick log",
    icon: "🥗",
    availableSizes: ["small", "medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
}

export const DEFAULT_MACROS_WIDGETS: WidgetInstance<MacrosWidgetType>[] = [
  {
    id: "default-macros-calendar",
    type: "macros_calendar",
    size: "large",
    order: 0,
  },
  {
    id: "default-macros-today",
    type: "macros_today",
    size: "medium",
    order: 1,
  },
]

export const MACROS_WIDGETS_STORAGE_KEY = STORAGE_KEYS.MACROS_TAB_WIDGETS

// ─── Body Fat tab ───────────────────────────────────────────────────────────

export type BodyFatWidgetType =
  | "bodyfat_height"
  | "bodyfat_calendar"
  | "bodyfat_latest"

export const BODYFAT_WIDGET_REGISTRY: Record<
  BodyFatWidgetType,
  WidgetDefinition<BodyFatWidgetType>
> = {
  bodyfat_height: {
    type: "bodyfat_height",
    title: "Height",
    description: "Your height, used for the body fat calculation",
    icon: "📏",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  bodyfat_calendar: {
    type: "bodyfat_calendar",
    title: "Body Fat Calendar",
    description: "Calendar view of days you've taken a body fat measurement",
    icon: "📅",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  bodyfat_latest: {
    type: "bodyfat_latest",
    title: "Body Fat %",
    description: "Your latest body fat measurement, with quick calculate",
    icon: "📐",
    availableSizes: ["small", "medium"],
    defaultSize: "medium",
    singleton: true,
  },
}

export const DEFAULT_BODYFAT_WIDGETS: WidgetInstance<BodyFatWidgetType>[] = [
  {
    id: "default-bodyfat-height",
    type: "bodyfat_height",
    size: "large",
    order: 0,
  },
  {
    id: "default-bodyfat-calendar",
    type: "bodyfat_calendar",
    size: "large",
    order: 1,
  },
  {
    id: "default-bodyfat-latest",
    type: "bodyfat_latest",
    size: "medium",
    order: 2,
  },
]

export const BODYFAT_WIDGETS_STORAGE_KEY = STORAGE_KEYS.BODYFAT_TAB_WIDGETS

// NOTE: add these four entries to STORAGE_KEYS in @shared/services/storage
// (next to HOME_WIDGETS) the same way home's storage key is wired up, e.g.:
//   WEIGHT_TAB_WIDGETS: "trackingScreen_weightWidgets",
//   PHOTOS_TAB_WIDGETS: "trackingScreen_photosWidgets",
//   MACROS_TAB_WIDGETS: "trackingScreen_macrosWidgets",
//   BODYFAT_TAB_WIDGETS: "trackingScreen_bodyfatWidgets",
