export type RootStackParamList = {
  Login: undefined
  Signup: undefined
}

export interface AuthUser {
  id: number | string
  username: string
  email: string
  name?: string
}

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
