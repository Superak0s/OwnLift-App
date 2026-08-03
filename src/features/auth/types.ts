export type { RootStackParamList } from "@shared/types";

// AuthUser is the shape of the user object returned by the auth endpoints.
// It's a re-export of the canonical User type from @shared/types.
import type { User as AuthUser } from "@shared/types";
export type { User as AuthUser } from "@shared/types";

export interface AuthResponse {
  success: boolean
  token?: string
  user: AuthUser
}

export interface SignupParams {
  username: string
  email: string
  password: string
  name?: string | null
}
