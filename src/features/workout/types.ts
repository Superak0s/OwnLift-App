// ─── Set details shape ─────────────────────────
export type { SetDetail } from "@shared/types"

// ─── Similarity match shape ─────────────────────────────────────────────────
export type { SimilarityMatch } from "@utils/exerciseMatching"

// ─── Partner banner props ───────────────────────────────────────────────────
export interface PartnerBannerProps {
  partnerProgress: Record<string, unknown> | null
  isPartnerReady: boolean
  syncPulse: boolean
  partnerUsername: string
  onLeave: () => void
}
