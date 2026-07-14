// ─── Set details shape (returned by getSetDetails) ─────────────────────────
export interface SetDetails {
  weight?: number
  reps?: number
  isWarmup?: boolean
  note?: string
  completedAt?: string
}

// ─── Similarity match shape ─────────────────────────────────────────────────
export interface SimilarityMatch {
  name: string
  similarity: number
}

// ─── Partner banner props ───────────────────────────────────────────────────
export interface PartnerBannerProps {
  partnerProgress: Record<string, unknown> | null
  isPartnerReady: boolean
  syncPulse: boolean
  partnerUsername: string
  onLeave: () => void
}
