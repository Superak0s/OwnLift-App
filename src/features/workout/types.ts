// ─── Set details shape ─────────────────────────
export type { SetDetail } from "@shared/types"

// ─── Similarity match shape ─────────────────────────────────────────────────
export type { SimilarityMatch } from "@utils/exerciseMatching"

// ─── Partner progress shape ─────────────────────────────────────────────────
export type { PartnerProgress } from "@shared/context/hooks/useJointSession"

// ─── Partner banner props ───────────────────────────────────────────────────
import type { PartnerProgress } from "@shared/context/hooks/useJointSession"

export interface PartnerBannerProps {
  partnerProgress: PartnerProgress | null
  isPartnerReady: boolean
  syncPulse: boolean
  partnerUsername: string
  onLeave: () => void
}
