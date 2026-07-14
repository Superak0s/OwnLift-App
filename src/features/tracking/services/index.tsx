// features/tracking/services/index.tsx

import { createDispatchProxy } from "@shared/services/dispatchProxy"
import {
  bodyTrackingApi as bodyTrackingApiOn,
  bodyFatApi as bodyFatApiOn,
  getCurrentBodyWeight as getCurrentBodyWeightOn,
} from "./on/bodyStats"
import {
  bodyTrackingApi as bodyTrackingApiOff,
  bodyFatApi as bodyFatApiOff,
  getCurrentBodyWeight as getCurrentBodyWeightOff,
} from "./off/bodyStats"
import { macrosTrackingApi as macrosTrackingApiOn } from "./on/macros"
import { macrosTrackingApi as macrosTrackingApiOff } from "./off/macros"
import { photoApi as photoApiOn } from "./on/photo"
import { photoApi as photoApiOff } from "./off/photo"

type BodyTrackingApiShape = typeof bodyTrackingApiOn
type BodyFatApiShape = typeof bodyFatApiOn
type MacrosTrackingApiShape = typeof macrosTrackingApiOn
type PhotoApiShape = typeof photoApiOn

export const bodyTrackingApi: BodyTrackingApiShape = createDispatchProxy(
  bodyTrackingApiOn,
  bodyTrackingApiOff,
)

export const bodyFatApi: BodyFatApiShape = createDispatchProxy(
  bodyFatApiOn,
  bodyFatApiOff,
)

export const macrosTrackingApi: MacrosTrackingApiShape = createDispatchProxy(
  macrosTrackingApiOn,
  macrosTrackingApiOff,
)

export const photoApi: PhotoApiShape = createDispatchProxy(
  photoApiOn,
  photoApiOff,
)

// getCurrentBodyWeight is a standalone function, not a method on either
// api object above, so it's wrapped in a tiny one-off shape to go through
// the same dispatch proxy rather than hand-rolling a mode check here.
const weightUtil = createDispatchProxy(
  { getCurrentBodyWeight: getCurrentBodyWeightOn },
  { getCurrentBodyWeight: getCurrentBodyWeightOff },
)
export const getCurrentBodyWeight = weightUtil.getCurrentBodyWeight

export type {
  WeightUnit,
  HeightUnit,
  Gender,
  HeightInput,
  BodyFatMeasurements,
  LogMacrosParams,
  MacrosGoals,
} from "../types"
