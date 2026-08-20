import { WEIGHT_TAB_CONFIG } from "./WeightTab";
import { PHOTOS_TAB_CONFIG } from "./PhotosTab";
import { MACROS_TAB_CONFIG } from "./MacrosTab";
import { BODYFAT_TAB_CONFIG } from "./BodyFatTab";
import { MEASUREMENTS_TAB_CONFIG } from "./MeasurementsTab";
import { HYDRATION_TAB_CONFIG } from "./HydrationTab";
import { SORENESS_TAB_CONFIG } from "./SorenessTab";
import { MENSTRUAL_TAB_CONFIG } from "./MenstrualTab";

export const TRACKING_TABS = [
  WEIGHT_TAB_CONFIG,
  PHOTOS_TAB_CONFIG,
  MACROS_TAB_CONFIG,
  BODYFAT_TAB_CONFIG,
  MEASUREMENTS_TAB_CONFIG,
  HYDRATION_TAB_CONFIG,
  SORENESS_TAB_CONFIG,
  MENSTRUAL_TAB_CONFIG,
];

export {
  WEIGHT_WIDGET_REGISTRY,
  DEFAULT_WEIGHT_WIDGETS,
  WEIGHT_WIDGETS_STORAGE_KEY,
  WEIGHT_TAB_CONFIG,
} from "./WeightTab";
export type { WeightWidgetType } from "./WeightTab";

export {
  PHOTOS_WIDGET_REGISTRY,
  DEFAULT_PHOTOS_WIDGETS,
  PHOTOS_WIDGETS_STORAGE_KEY,
  PHOTOS_TAB_CONFIG,
} from "./PhotosTab";
export type { PhotosWidgetType } from "./PhotosTab";

export {
  MACROS_WIDGET_REGISTRY,
  DEFAULT_MACROS_WIDGETS,
  MACROS_WIDGETS_STORAGE_KEY,
  MACROS_TAB_CONFIG,
} from "./MacrosTab";
export type { MacrosWidgetType } from "./MacrosTab";

export {
  BODYFAT_WIDGET_REGISTRY,
  DEFAULT_BODYFAT_WIDGETS,
  BODYFAT_WIDGETS_STORAGE_KEY,
  BODYFAT_TAB_CONFIG,
} from "./BodyFatTab";
export type { BodyFatWidgetType } from "./BodyFatTab";

export {
  MEASUREMENTS_WIDGET_REGISTRY,
  DEFAULT_MEASUREMENTS_WIDGETS,
  MEASUREMENTS_WIDGETS_STORAGE_KEY,
  MEASUREMENTS_TAB_CONFIG,
} from "./MeasurementsTab";
export type { MeasurementsWidgetType } from "./MeasurementsTab";

export {
  HYDRATION_WIDGET_REGISTRY,
  DEFAULT_HYDRATION_WIDGETS,
  HYDRATION_WIDGETS_STORAGE_KEY,
  HYDRATION_TAB_CONFIG,
} from "./HydrationTab";
export type { HydrationWidgetType } from "./HydrationTab";
export { LogHydrationModal, HydrationSettingsWidget } from "./HydrationTab";

export {
  SORENESS_WIDGET_REGISTRY,
  DEFAULT_SORENESS_WIDGETS,
  SORENESS_WIDGETS_STORAGE_KEY,
  SORENESS_TAB_CONFIG,
} from "./SorenessTab";
export type { SorenessWidgetType } from "./SorenessTab";
export {
  DOMSFollowUpWidget,
  DOMSHeatmapWidget,
  InjuryTrackerWidget,
  LogSorenessModal,
} from "./SorenessTab";

export {
  MENSTRUAL_WIDGET_REGISTRY,
  DEFAULT_MENSTRUAL_WIDGETS,
  MENSTRUAL_WIDGETS_STORAGE_KEY,
  MENSTRUAL_TAB_CONFIG,
} from "./MenstrualTab";
export type { MenstrualWidgetType } from "./MenstrualTab";
export { LogCycleModal, CycleSettingsWidget } from "./MenstrualTab";
