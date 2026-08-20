export type { SetDetail } from "@shared/types"

export type { SimilarityMatch } from "@utils/exerciseMatching"

export type { PartnerProgress } from "@shared/context/hooks/useJointSession"

import type { PartnerProgress } from "@shared/context/hooks/useJointSession"

export interface PartnerBannerProps {
  partnerProgress: PartnerProgress | null
  isPartnerReady: boolean
  syncPulse: boolean
  partnerUsername: string
  onLeave: () => void
}
