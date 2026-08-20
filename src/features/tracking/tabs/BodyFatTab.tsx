import { STORAGE_KEYS } from "@shared/services/storage";
import type { WidgetDefinition, WidgetInstance } from "@shared/types";


export type BodyFatWidgetType =
  | "bodyfat_height"
  | "bodyfat_calendar"
  | "bodyfat_latest";

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
};

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
];

export const BODYFAT_WIDGETS_STORAGE_KEY = STORAGE_KEYS.BODYFAT_TAB_WIDGETS;


export const BODYFAT_TAB_CONFIG = {
  key: "bodyfat",
  icon: "📐",
  label: "Body Fat",
};
