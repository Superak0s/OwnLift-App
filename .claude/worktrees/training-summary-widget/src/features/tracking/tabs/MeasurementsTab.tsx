// src/features/tracking/tabs/MeasurementsTab.tsx
//
// Measurements tab - contains all widget definitions, registry, and defaults
// for the body measurements tracking functionality.

import { STORAGE_KEYS } from "@shared/services/storage";
import type { WidgetDefinition, WidgetInstance } from "@shared/types";

// ─── Measurements tab widget types ──────────────────────────────────────────

export type MeasurementsWidgetType =
  | "measurements_overview"
  | "measurements_calendar"
  | "measurements_chart"
  | "measurements_history";

export const MEASUREMENTS_WIDGET_REGISTRY: Record<
  MeasurementsWidgetType,
  WidgetDefinition<MeasurementsWidgetType>
> = {
  measurements_overview: {
    type: "measurements_overview",
    title: "Latest Measurements",
    description: "Your latest body measurements (waist, arms, chest)",
    icon: "📏",
    availableSizes: ["small", "medium"],
    defaultSize: "medium",
    singleton: true,
  },
  measurements_calendar: {
    type: "measurements_calendar",
    title: "Measurements Calendar",
    description: "Calendar view of days you've logged measurements",
    icon: "📅",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  measurements_chart: {
    type: "measurements_chart",
    title: "Measurements Trend",
    description: "Track waist, arms, and chest changes over time",
    icon: "📈",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  measurements_history: {
    type: "measurements_history",
    title: "Measurements History",
    description: "Your recent measurement entries",
    icon: "📋",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
};

export const DEFAULT_MEASUREMENTS_WIDGETS: WidgetInstance<MeasurementsWidgetType>[] = [
  {
    id: "default-measurements-overview",
    type: "measurements_overview",
    size: "medium",
    order: 0,
  },
  {
    id: "default-measurements-calendar",
    type: "measurements_calendar",
    size: "large",
    order: 1,
  },
  {
    id: "default-measurements-history",
    type: "measurements_history",
    size: "medium",
    order: 2,
  },
  {
    id: "default-measurements-chart",
    type: "measurements_chart",
    size: "medium",
    order: 3,
  },
];

export const MEASUREMENTS_WIDGETS_STORAGE_KEY =
  STORAGE_KEYS.MEASUREMENTS_TAB_WIDGETS;

// ─── Tab configuration ──────────────────────────────────────────────────────

export const MEASUREMENTS_TAB_CONFIG = {
  key: "measurements",
  icon: "📏",
  label: "Measurements",
};
