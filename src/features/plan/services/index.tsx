import { createDispatchProxy } from "@shared/services/dispatchProxy"
import { programApi as programApiOn } from "./on/program"
import { programApi as programApiOff } from "./off/program"

type ProgramApiShape = typeof programApiOn

export const programApi: ProgramApiShape = createDispatchProxy(
  programApiOn,
  programApiOff,
)

export type { SavedProgram, ExercisePayload } from "../types"
