export type { RootStackParamList } from "@shared/types";

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
