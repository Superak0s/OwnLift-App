// features/auth/services/index.tsx

import { createDispatchProxy } from "@shared/services/dispatchProxy"
import {
  authService as onAuthService,
  authenticatedFetch as onAuthenticatedFetch,
} from "./on/auth"
import {
  authService as offAuthService,
  authenticatedFetch as offAuthenticatedFetch,
} from "./off/auth"

// Merge each side's service methods with authenticatedFetch into one
// object so createDispatchProxy can dispatch everything uniformly.
const onAuth = {
  ...onAuthService,
  authenticatedFetch: onAuthenticatedFetch,
}

const offAuth = {
  ...offAuthService,
  authenticatedFetch: offAuthenticatedFetch,
}

type AuthShape = typeof onAuth

const auth: AuthShape = createDispatchProxy(onAuth, offAuth)

export const authService = auth
export const { authenticatedFetch } = auth

export type { AuthUser, AuthResponse, SignupParams } from "../types"
