// features/auth/services/index.tsx

import { createDispatchProxy } from "@shared/services/dispatchProxy"
import { authService as onAuthService } from "./on/auth"
import { authService as offAuthService } from "./off/auth"

type AuthServiceShape = typeof onAuthService

export const authService: AuthServiceShape = createDispatchProxy(
  onAuthService,
  offAuthService,
)

export type { AuthUser, AuthResponse, SignupParams } from "../types"
