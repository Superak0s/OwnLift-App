import { createDispatchProxy } from "@shared/services/dispatchProxy"
import { supplementsApi as supplementsApiOn } from "./on/supplements"
import { supplementsApi as supplementsApiOff } from "./off/supplements"

type SupplementsApiShape = typeof supplementsApiOn

export const supplementsApi: SupplementsApiShape = createDispatchProxy(
  supplementsApiOn,
  supplementsApiOff,
)

export type {
  ReminderLocation as SupplementLocationParams,
  SupplementSummary,
  SupplementEntry,
  SupplementLocation,
  CreateSupplementParams,
  UpdateSupplementParams,
  LogSupplementParams,
  AtLocationResult,
  SupplementLogResponse,
} from "../types"
