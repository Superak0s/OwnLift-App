import { STORAGE_KEYS } from "@shared/services/storage";
import type { WidgetDefinition, WidgetInstance } from "@shared/types";


export type MacrosWidgetType = "macros_calendar" | "macros_today";

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
};

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
];

export const MACROS_WIDGETS_STORAGE_KEY = STORAGE_KEYS.MACROS_TAB_WIDGETS;


export const MACROS_TAB_CONFIG = {
  key: "macros",
  icon: "🥗",
  label: "Macros",
};
