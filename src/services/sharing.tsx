import { getServerUrl } from './config'
import { authenticatedFetch } from './auth'

export type PermissionType = 'history' | 'analytics' | 'program' | 'joint_session' | 'watch_session'

export interface GrantedPermission {
  id: number | string
  toUserId: number | string
  toUsername: string
  permissionType: PermissionType
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface ReceivedPermission {
  id: number | string
  fromUserId: number | string
  fromUsername: string
  permissionType: PermissionType
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface SharedProgram {
  id: number | string
  senderId?: number | string
  senderUsername?: string
  receiverId?: number | string
  receiverUsername?: string
  sharedAt: string
  message?: string | null
  programData: unknown
}

export interface JointInviteParams {
  toUserId: number | string
  fromSessionId: string
}

/**
 * Sharing API
 */
export const sharingApi = {
  // ── Unified permissions ────────────────────────────────────────────────────

  /**
   * Grant a permission to a friend.
   * POST /api/sharing/permissions
   */
  grantPermission: async (
    friendId: number | string,
    permissionType: PermissionType,
    payload: Record<string, unknown> | null = null,
  ): Promise<unknown> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/permissions`,
      {
        method: 'POST',
        body: JSON.stringify({ friendId, permissionType, payload }),
      },
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to grant permission')
    return data
  },

  /**
   * Revoke a permission I previously granted.
   * DELETE /api/sharing/permissions/:permissionId
   */
  revokePermission: async (permissionId: number | string): Promise<unknown> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/permissions/${permissionId}`,
      { method: 'DELETE' },
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to revoke permission')
    return data
  },

  /** All permissions I have granted to friends. */
  getGrantedPermissions: async (): Promise<GrantedPermission[]> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/permissions/granted`,
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get granted permissions')
    return (data.permissions || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      toUserId: p.to_user_id,
      toUsername: p.to_username,
      permissionType: p.permission_type as PermissionType,
      payload: p.payload ?? null,
      createdAt: p.created_at,
    }))
  },

  /** All permissions friends have granted me. */
  getReceivedPermissions: async (): Promise<ReceivedPermission[]> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/permissions/received`,
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get received permissions')
    return (data.permissions || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      fromUserId: p.from_user_id,
      fromUsername: p.from_username,
      permissionType: p.permission_type as PermissionType,
      payload: p.payload ?? null,
      createdAt: p.created_at,
    }))
  },

  // ── Analytics ──────────────────────────────────────────────────────────────

  shareAnalytics: async (
    friendId: number | string,
    _includeAllSessions: unknown,
    _dayNumber: unknown,
    message: string | null = null,
  ): Promise<unknown> => {
    return sharingApi.grantPermission(friendId, 'analytics', message ? { message } : null)
  },

  getReceivedAnalytics: async (): Promise<unknown[]> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/analytics/received`,
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get received analytics')
    return data.shares || []
  },

  getSentAnalytics: async (): Promise<unknown[]> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/analytics/sent`,
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get sent analytics')
    return data.shares || []
  },

  viewFriendAnalytics: async (_shareId: unknown, friendId: number | string): Promise<unknown> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/analytics/friend/${friendId}`,
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to view friend analytics')
    return data.analytics
  },

  // ── Program ────────────────────────────────────────────────────────────────

  shareProgram: async (
    friendId: number | string,
    programData: unknown,
    message: string | null = null,
  ): Promise<unknown> => {
    return sharingApi.grantPermission(friendId, 'program', { programData, message })
  },

  getReceivedPrograms: async (): Promise<SharedProgram[]> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/program/received`,
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get received programs')
    return (data.programs || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      senderId: p.senderId,
      senderUsername: p.senderUsername,
      sharedAt: p.sharedAt,
      message: p.message,
      programData: p.programData,
    }))
  },

  getSentPrograms: async (): Promise<SharedProgram[]> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/program/sent`,
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get sent programs')
    return (data.programs || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      receiverId: p.receiverId,
      receiverUsername: p.receiverUsername,
      sharedAt: p.sharedAt,
      message: p.message,
      programData: p.programData,
    }))
  },

  deleteShare: async (_shareType: string, permissionId: number | string): Promise<unknown> => {
    return sharingApi.revokePermission(permissionId)
  },

  // ── Session history ────────────────────────────────────────────────────────

  getFriendSessions: async (friendId: number | string, limit: number = 60): Promise<unknown[]> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/sessions/friend/${friendId}?limit=${limit}`,
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get friend sessions')
    return data.sessions || []
  },

  getFriendSessionDetails: async (
    friendId: number | string,
    sessionId: number | string,
  ): Promise<unknown | null> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/sessions/friend/${friendId}/${sessionId}`,
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get friend session details')
    return data.session || null
  },

  // ── Stats ──────────────────────────────────────────────────────────────────

  getSharingStats: async (): Promise<unknown> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(`${API_BASE_URL}/api/sharing/stats`)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get sharing stats')
    return data.stats
  },

  // ── Joint sessions ─────────────────────────────────────────────────────────

  getFriendSessionStatus: async (
    friendId: number | string,
  ): Promise<{ hasActiveSession: boolean } | unknown> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/friend/${friendId}/status`,
    )
    if (response.status === 404) return { hasActiveSession: false }
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get friend session status')
    return data
  },

  sendJointInvite: async ({ toUserId, fromSessionId }: JointInviteParams): Promise<unknown> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/invite`,
      {
        method: 'POST',
        body: JSON.stringify({ toUserId, fromSessionId }),
      },
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to send joint invite')
    return data
  },

  getInviteStatus: async (inviteId: number | string): Promise<unknown | null> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/invites/${inviteId}`,
    )
    if (response.status === 404) return null
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get invite status')
    return data
  },

  getMyPendingInvite: async (): Promise<unknown | null> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/invites/pending`,
    )
    if (response.status === 404) return null
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get pending invite')
    return data
  },

  acceptJointInvite: async (inviteId: number | string): Promise<unknown> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/invites/${inviteId}/accept`,
      { method: 'POST' },
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to accept joint invite')
    return data
  },

  declineJointInvite: async (inviteId: number | string): Promise<unknown> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/invites/${inviteId}/decline`,
      { method: 'POST' },
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to decline joint invite')
    return data
  },

  getJointSession: async (jointSessionId: string): Promise<unknown | null> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/${jointSessionId}`,
    )
    if (response.status === 404) return null
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get joint session')
    return data.jointSession ?? data
  },

  pushJointProgress: async (jointSessionId: string, progress: unknown): Promise<unknown> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/${jointSessionId}/progress`,
      { method: 'PATCH', body: JSON.stringify(progress) },
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to push progress')
    return data
  },

  leaveJointSession: async (jointSessionId: string): Promise<unknown> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/${jointSessionId}/leave`,
      { method: 'DELETE' },
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to leave joint session')
    return data
  },

  // ── Watch session ──────────────────────────────────────────────────────────

  getFriendActiveSession: async (friendId: number | string): Promise<unknown | null> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/watch/friend/${friendId}/active`,
    )
    if (response.status === 404 || response.status === 403) return null
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get friend active session')
    return data.session ?? null
  },

  getFriendLiveSession: async (
    friendId: number | string,
    sessionId: number | string,
  ): Promise<unknown | null> => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/watch/friend/${friendId}/session/${sessionId}/live`,
    )
    if (response.status === 404 || response.status === 403) return null
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to get friend live session')
    return data.liveSession ?? null
  },
}
