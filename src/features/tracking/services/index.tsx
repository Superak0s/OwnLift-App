import { createDispatchProxy } from "@shared/services/dispatchProxy";
import {
  bodyTrackingApi as bodyTrackingApiOn,
  bodyFatApi as bodyFatApiOn,
  getCurrentBodyWeight as getCurrentBodyWeightOn,
} from "./on/bodyStats";
import {
  bodyTrackingApi as bodyTrackingApiOff,
  bodyFatApi as bodyFatApiOff,
  getCurrentBodyWeight as getCurrentBodyWeightOff,
} from "./off/bodyStats";
import { macrosTrackingApi as macrosTrackingApiOn } from "./on/macros";
import { macrosTrackingApi as macrosTrackingApiOff } from "./off/macros";
import { photoApi as photoApiOn } from "./on/photo";
import { photoApi as photoApiOff } from "./off/photo";
import { hydrationApi as hydrationApiOn } from "./on/hydration";
import { sorenessApi as sorenessApiOn } from "./on/soreness";
import { domsApi as domsApiOn } from "./on/doms";
import { domsApi as domsApiOff } from "./off/doms";
import { injuryApi as injuryApiOn } from "./on/injury";
import { injuryApi as injuryApiOff } from "./off/injury";
import { progressPhotoApi as progressPhotoApiOn } from "./on/progressPhoto";
import { progressPhotoApi as progressPhotoApiOff } from "./off/progressPhoto";
import { personalNotesApi as personalNotesApiOn } from "./on/personalNotes";
import { personalNotesApi as personalNotesApiOff } from "./off/personalNotes";
import { bodyMeasurementsApi as bodyMeasurementsApiOn } from "./on/bodyMeasurements";
import { menstrualApi as menstrualApiOn } from "./on/menstrual";

type BodyTrackingApiShape = typeof bodyTrackingApiOn;
type BodyFatApiShape = typeof bodyFatApiOn;
type MacrosTrackingApiShape = typeof macrosTrackingApiOn;
type PhotoApiShape = typeof photoApiOn;
type HydrationApiShape = typeof hydrationApiOn;
type SorenessApiShape = typeof sorenessApiOn;
type DomsApiShape = typeof domsApiOn;
type InjuryApiShape = typeof injuryApiOn;
type ProgressPhotoApiShape = typeof progressPhotoApiOn;
type PersonalNotesApiShape = typeof personalNotesApiOn;
type BodyMeasurementsApiShape = typeof bodyMeasurementsApiOn;
type MenstrualApiShape = typeof menstrualApiOn;

export const bodyTrackingApi: BodyTrackingApiShape = createDispatchProxy(
  bodyTrackingApiOn,
  bodyTrackingApiOff,
);

export const bodyFatApi: BodyFatApiShape = createDispatchProxy(
  bodyFatApiOn,
  bodyFatApiOff,
);

export const macrosTrackingApi: MacrosTrackingApiShape = createDispatchProxy(
  macrosTrackingApiOn,
  macrosTrackingApiOff,
);

export const photoApi: PhotoApiShape = createDispatchProxy(
  photoApiOn,
  photoApiOff,
);

// No offline equivalents — server-only APIs
export const hydrationApi: HydrationApiShape = hydrationApiOn;
export const sorenessApi: SorenessApiShape = sorenessApiOn;
export const domsApi: DomsApiShape = createDispatchProxy(domsApiOn, domsApiOff);
export const injuryApi: InjuryApiShape = createDispatchProxy(
  injuryApiOn,
  injuryApiOff,
);
export const progressPhotoApi: ProgressPhotoApiShape = createDispatchProxy(
  progressPhotoApiOn,
  progressPhotoApiOff,
);
export const personalNotesApi: PersonalNotesApiShape = createDispatchProxy(
  personalNotesApiOn,
  personalNotesApiOff,
);
export const bodyMeasurementsApi: BodyMeasurementsApiShape = bodyMeasurementsApiOn;
export const menstrualApi: MenstrualApiShape = menstrualApiOn;

// getCurrentBodyWeight is a standalone function, not a method on either
// api object above, so it's wrapped in a tiny one-off shape to go through
// the same dispatch proxy rather than hand-rolling a mode check here.
const weightUtil = createDispatchProxy(
  { getCurrentBodyWeight: getCurrentBodyWeightOn },
  { getCurrentBodyWeight: getCurrentBodyWeightOff },
);
export const getCurrentBodyWeight = weightUtil.getCurrentBodyWeight;

export type {
  WeightUnit,
  HeightUnit,
  Gender,
  HeightInput,
  BodyFatMeasurements,
  LogMacrosParams,
  MacrosGoals,
} from "../types";
