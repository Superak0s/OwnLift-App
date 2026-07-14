// features/supplements/services/index.tsx

import { createDispatchProxy } from "@shared/services/dispatchProxy"
import {
  supplementsApi as supplementsApiOn,
  creatineApi as creatineApiOn,
} from "./on/supplements"
import {
  supplementsApi as supplementsApiOff,
  creatineApi as creatineApiOff,
} from "./off/supplements"

type SupplementsApiShape = typeof supplementsApiOn
type CreatineApiShape = typeof creatineApiOn

export const supplementsApi: SupplementsApiShape = createDispatchProxy(
  supplementsApiOn,
  supplementsApiOff,
)

export const creatineApi: CreatineApiShape = createDispatchProxy(
  creatineApiOn,
  creatineApiOff,
)

export type {
  SupplementSummary,
  SupplementEntry,
  SupplementLocation,
  CreateSupplementParams,
  UpdateSupplementParams,
  LogSupplementParams,
  SupplementLocationParams,
  AtLocationResult,
  SupplementLogResponse,
} from "../types"
