import { getServerUrl } from "./config"
import { authenticatedFetch } from "./auth"

/**
 * Sharing API
 * Routes registered under /api/sharing/
 *
 * All five sharing types are now unified permissions:
 *   'history'       – view workout history
 *   'analytics'     – view workout analytics
 *   'program'       – share a workout program  (payload: { programData, message })
 *   'joint_session' – lift together
 *   'watch_session' – watch live session
 */
export const sharingApi = {
  // ──────────────────────────────────────────────────────────────────────────
  // Unified permissions
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Grant a permission to a friend.
   * POST /api/sharing/permissions
   * @param {number} friendId
   * @param {string} permissionType  – one of the five types above
   * @param {object|null} payload    – required for 'program': { programData, message? }
   *                                   optional for 'analytics': { message? }
   */
  grantPermission: async (friendId, permissionType, payload = null) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/permissions`,
      {
        method: "POST",
        body: JSON.stringify({ friendId, permissionType, payload }),
      },
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to grant permission")
    return data
  },

  /**
   * Revoke a permission I previously granted.
   * DELETE /api/sharing/permissions/:permissionId
   */
  revokePermission: async (permissionId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/permissions/${permissionId}`,
      { method: "DELETE" },
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to revoke permission")
    return data
  },

  /**
   * All permissions I have granted to friends.
   * GET /api/sharing/permissions/granted
   * → [{ id, toUserId, toUsername, permissionType, payload, createdAt }]
   */
  getGrantedPermissions: async () => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/permissions/granted`,
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get granted permissions")
    return (data.permissions || []).map((p) => ({
      id: p.id,
      toUserId: p.to_user_id,
      toUsername: p.to_username,
      permissionType: p.permission_type,
      payload: p.payload ?? null,
      createdAt: p.created_at,
    }))
  },

  /**
   * All permissions friends have granted me.
   * GET /api/sharing/permissions/received
   * → [{ id, fromUserId, fromUsername, permissionType, payload, createdAt }]
   */
  getReceivedPermissions: async () => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/permissions/received`,
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get received permissions")
    return (data.permissions || []).map((p) => ({
      id: p.id,
      fromUserId: p.from_user_id,
      fromUsername: p.from_username,
      permissionType: p.permission_type,
      payload: p.payload ?? null,
      createdAt: p.created_at,
    }))
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Convenience: analytics
  // These thin wrappers call the generic routes but keep call-sites readable.
  // ──────────────────────────────────────────────────────────────────────────

  /** Share analytics with a friend (grants 'analytics' permission). */
  shareAnalytics: async (
    friendId,
    _includeAllSessions,
    _dayNumber,
    message = null,
  ) => {
    return sharingApi.grantPermission(
      friendId,
      "analytics",
      message ? { message } : null,
    )
  },

  getReceivedAnalytics: async () => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/analytics/received`,
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get received analytics")
    return data.shares || []
  },

  getSentAnalytics: async () => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/analytics/sent`,
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get sent analytics")
    return data.shares || []
  },

  viewFriendAnalytics: async (_shareId, friendId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/analytics/friend/${friendId}`,
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to view friend analytics")
    return data.analytics
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Convenience: program
  // ──────────────────────────────────────────────────────────────────────────

  /** Share a program with a friend (grants 'program' permission with payload). */
  shareProgram: async (friendId, programData, message = null) => {
    return sharingApi.grantPermission(friendId, "program", {
      programData,
      message,
    })
  },

  getReceivedPrograms: async () => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/program/received`,
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get received programs")
    return (data.programs || []).map((p) => ({
      id: p.id,
      senderId: p.senderId,
      senderUsername: p.senderUsername,
      sharedAt: p.sharedAt,
      message: p.message,
      programData: p.programData,
    }))
  },

  getSentPrograms: async () => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/program/sent`,
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get sent programs")
    return (data.programs || []).map((p) => ({
      id: p.id,
      receiverId: p.receiverId,
      receiverUsername: p.receiverUsername,
      sharedAt: p.sharedAt,
      message: p.message,
      programData: p.programData,
    }))
  },

  /**
   * Delete any share (analytics or program) by revoking the permission.
   * The old /api/sharing/:shareType/:shareId DELETE is gone; this maps
   * shareType to a revokePermission call.
   */
  deleteShare: async (_shareType, permissionId) => {
    return sharingApi.revokePermission(permissionId)
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Session history
  // ──────────────────────────────────────────────────────────────────────────

  getFriendSessions: async (friendId, limit = 60) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/sessions/friend/${friendId}?limit=${limit}`,
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get friend sessions")
    return data.sessions || []
  },

  getFriendSessionDetails: async (friendId, sessionId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/sessions/friend/${friendId}/${sessionId}`,
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get friend session details")
    return data.session || null
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────────────────────────────────────

  getSharingStats: async () => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/stats`,
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get sharing stats")
    return data.stats
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Joint sessions
  // ──────────────────────────────────────────────────────────────────────────

  getFriendSessionStatus: async (friendId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/friend/${friendId}/status`,
    )
    if (response.status === 404) return { hasActiveSession: false }
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get friend session status")
    return data
  },

  sendJointInvite: async ({ toUserId, fromSessionId }) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/invite`,
      {
        method: "POST",
        body: JSON.stringify({ toUserId, fromSessionId }),
      },
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to send joint invite")
    return data
  },

  getInviteStatus: async (inviteId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/invites/${inviteId}`,
    )
    if (response.status === 404) return null
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get invite status")
    return data
  },

  getMyPendingInvite: async () => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/invites/pending`,
    )
    if (response.status === 404) return null
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get pending invite")
    return data
  },

  acceptJointInvite: async (inviteId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/invites/${inviteId}/accept`,
      { method: "POST" },
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to accept joint invite")
    return data
  },

  declineJointInvite: async (inviteId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/invites/${inviteId}/decline`,
      { method: "POST" },
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to decline joint invite")
    return data
  },

  getJointSession: async (jointSessionId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/${jointSessionId}`,
    )
    if (response.status === 404) return null
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get joint session")
    return data.jointSession ?? data
  },

  pushJointProgress: async (jointSessionId, progress) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/${jointSessionId}/progress`,
      { method: "PATCH", body: JSON.stringify(progress) },
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Failed to push progress")
    return data
  },

  leaveJointSession: async (jointSessionId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/joint-sessions/${jointSessionId}/leave`,
      { method: "DELETE" },
    )
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to leave joint session")
    return data
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Watch session
  // ──────────────────────────────────────────────────────────────────────────

  getFriendActiveSession: async (friendId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/watch/friend/${friendId}/active`,
    )
    if (response.status === 404 || response.status === 403) return null
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get friend active session")
    return data.session ?? null
  },

  getFriendLiveSession: async (friendId, sessionId) => {
    const API_BASE_URL = getServerUrl()
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/sharing/watch/friend/${friendId}/session/${sessionId}/live`,
    )
    if (response.status === 404 || response.status === 403) return null
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || "Failed to get friend live session")
    return data.liveSession ?? null
  },
}
