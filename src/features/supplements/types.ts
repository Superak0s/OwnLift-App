export interface SupplementTemplate {
  name: string
  icon: string
  unit: string
  defaultAmount: number
  color: string
  description: string
}

export interface SelectedLocation {
  lat: number
  lng: number
  address: string
  radius: number
}

export interface MarkerPosition {
  latitude: number
  longitude: number
}

export interface NominatimAddress {
  road?: string
  house_number?: string
  suburb?: string
  city?: string
  state?: string
  country?: string
}

export interface WebViewMessage {
  type: "mapClick" | "mapReady"
  lat?: number
  lng?: number
}

export interface SupplementSummary {
  id: number
  name: string
  unit: string
  defaultAmount: number
  reminderEnabled: boolean
  reminderTime: string | null
  locationReminderEnabled: boolean
  color: string | null
  icon: string | null
  takenToday: boolean
  streak: number
}

export interface SupplementEntry {
  id: number
  supplementId: number
  amount: number
  takenAt: string
  note: string | null
  createdAt: string
}

export interface SupplementLocation {
  id: number
  supplementId: number
  latitude: number
  longitude: number
  address: string
  radius: number
  enabled: boolean
}

export interface CreateSupplementParams {
  name: string
  unit?: string
  defaultAmount?: number
  reminderEnabled?: boolean
  reminderTime?: string | null
  color?: string | null
  icon?: string | null
}

export interface UpdateSupplementParams extends Partial<CreateSupplementParams> {
  locationReminderEnabled?: boolean
}

export interface LogSupplementParams {
  amount?: number
  takenAt?: string | null
  note?: string | null
}

export interface SupplementLocationParams {
  latitude: number
  longitude: number
  address: string
  radius: number
}

export interface AtLocationResult {
  withinRadius: boolean
  reason?: string
  distance?: number
  radius?: number
  address?: string
}

export interface SupplementLogResponse {
  success: boolean
  entries: SupplementEntry[]
  streak: number
  takenToday: boolean
  todayEntry: SupplementEntry | null
}
