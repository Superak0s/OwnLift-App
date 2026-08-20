import { STORAGE_KEYS } from "@shared/services/storage";
import type { WidgetDefinition, WidgetInstance } from "@shared/types";


export type WeightWidgetType =
  | "weight_overview"
  | "weight_calendar"
  | "weight_history"
  | "weight_chart";

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
};

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
];

export const WEIGHT_WIDGETS_STORAGE_KEY = STORAGE_KEYS.WEIGHT_TAB_WIDGETS;


export const WEIGHT_TAB_CONFIG = {
  key: "weight",
  icon: "⚖️",
  label: "Weight",
};
