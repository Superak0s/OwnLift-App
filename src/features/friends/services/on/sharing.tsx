import { apiCall, parseApiResponse } from "@shared/services/apiClient"
import { authenticatedFetch } from "@shared/services/authenticatedFetch"
import type {
  PermissionType,
  GrantedPermission,
  ReceivedPermission,
  ReceivedProgram,
  SentProgram,
  JointInviteParams,
} from "../../types"

/**
 * Sharing API
 */
export const sharingApi = {
  grantPermission: async (
    friendId: number | string,
    permissionType: PermissionType,
    payload: Record<string, unknown> | null = null,
  ): Promise<unknown> =>
    apiCall(`/api/sharing/permissions`, {
      method: "POST",
      body: JSON.stringify({ friendId, permissionType, payload }),
    }),

  revokePermission: async (permissionId: number | string): Promise<unknown> =>
    apiCall(`/api/sharing/permissions/${permissionId}`, { method: "DELETE" }),

  getGrantedPermissions: async (): Promise<GrantedPermission[]> => {
    const data = await apiCall<{ permissions: Record<string, unknown>[] }>(
      `/api/sharing/permissions/granted`,
    )
    return (data.permissions || []).map((p) => ({
      id: p.id as string | number,
      toUserId: p.to_user_id as string | number,
      toUsername: p.to_username as string,
      permissionType: p.permission_type as PermissionType,
      payload: p.payload ?? null,
      createdAt: p.created_at as string,
    })) as GrantedPermission[]
  },

  getReceivedPermissions: async (): Promise<ReceivedPermission[]> => {
    const data = await apiCall<{ permissions: Record<string, unknown>[] }>(
      `/api/sharing/permissions/received`,
    )
    return (data.permissions || []).map((p) => ({
      id: p.id as string | number,
      fromUserId: p.from_user_id as string | number,
      fromUsername: p.from_username as string,
      permissionType: p.permission_type as PermissionType,
      payload: p.payload ?? null,
      createdAt: p.created_at as string,
    })) as ReceivedPermission[]
  },

  shareAnalytics: async (
    friendId: number | string,
    _includeAllSessions: unknown,
    _dayNumber: unknown,
    message: string | null = null,
  ): Promise<unknown> =>
    sharingApi.grantPermission(friendId, "analytics", message ? { message } : null),

  getReceivedAnalytics: async (): Promise<unknown[]> => {
    const data = await apiCall<{ shares: unknown[] }>(
      `/api/sharing/analytics/received`,
    )
    return data.shares || []
  },

  getSentAnalytics: async (): Promise<unknown[]> => {
    const data = await apiCall<{ shares: unknown[] }>(
      `/api/sharing/analytics/sent`,
    )
    return data.shares || []
  },

  viewFriendAnalytics: async (
    _shareId: unknown,
    friendId: number | string,
  ): Promise<unknown> => {
    const data = await apiCall<{ analytics: unknown }>(
      `/api/sharing/analytics/friend/${friendId}`,
    )
    return data.analytics
  },

  shareProgram: async (
    friendId: number | string,
    programData: unknown,
    message: string | null = null,
  ): Promise<unknown> =>
    sharingApi.grantPermission(friendId, "program", { programData, message }),

  getReceivedPrograms: async (): Promise<ReceivedProgram[]> => {
    const data = await apiCall<{ programs: Record<string, unknown>[] }>(
      `/api/sharing/program/received`,
    )
    return (data.programs || []).map((p) => ({
      id: p.id,
      senderId: p.senderId,
      senderUsername: p.senderUsername,
      sharedAt: p.sharedAt,
      message: p.message,
      programData: p.programData,
    })) as ReceivedProgram[]
  },

  getSentPrograms: async (): Promise<SentProgram[]> => {
    const data = await apiCall<{ programs: Record<string, unknown>[] }>(
      `/api/sharing/program/sent`,
    )
    return (data.programs || []).map((p) => ({
      id: p.id,
      receiverId: p.receiverId,
      receiverUsername: p.receiverUsername,
      sharedAt: p.sharedAt,
      message: p.message,
      programData: p.programData,
    })) as SentProgram[]
  },

  deleteShare: async (
    _shareType: string,
    permissionId: number | string,
  ): Promise<unknown> =>
    sharingApi.revokePermission(permissionId),

  getFriendSessions: async (
    friendId: number | string,
    limit: number = 60,
  ): Promise<unknown[]> => {
    const data = await apiCall<{ sessions: unknown[] }>(
      `/api/sharing/sessions/friend/${friendId}?limit=${limit}`,
    )
    return data.sessions || []
  },

  getFriendSessionDetails: async (
    friendId: number | string,
    sessionId: number | string,
  ): Promise<any | null> => {
    const data = await apiCall<{ session: unknown }>(
      `/api/sharing/sessions/friend/${friendId}/${sessionId}`,
    )
    return data.session || null
  },

  getSharingStats: async (): Promise<unknown> => {
    const data = await apiCall<{ stats: unknown }>(`/api/sharing/stats`)
    return data.stats
  },

  // Needs raw response for 404 check
  getFriendSessionStatus: async (
    friendId: number | string,
  ): Promise<{ hasActiveSession: boolean }> => {
    const response = await authenticatedFetch(
      `/api/sharing/joint-sessions/friend/${friendId}/status`,
    )
    if (response.status === 404) return { hasActiveSession: false }
    return parseApiResponse(response)
  },

  sendJointInvite: async ({
    toUserId,
    fromSessionId,
  }: JointInviteParams): Promise<unknown> =>
    apiCall(`/api/sharing/joint-sessions/invite`, {
      method: "POST",
      body: JSON.stringify({ toUserId, fromSessionId }),
    }),

  getInviteStatus: async (
    inviteId: number | string,
  ): Promise<any | null> => {
    const response = await authenticatedFetch(
      `/api/sharing/joint-sessions/invites/${inviteId}`,
    )
    if (response.status === 404) return null
    return parseApiResponse(response)
  },

  getMyPendingInvite: async (): Promise<any | null> => {
    const response = await authenticatedFetch(
      `/api/sharing/joint-sessions/invites/pending`,
    )
    if (response.status === 404) return null
    return parseApiResponse(response)
  },

  acceptJointInvite: async (inviteId: number | string): Promise<unknown> =>
    apiCall(`/api/sharing/joint-sessions/invites/${inviteId}/accept`, {
      method: "POST",
    }),

  declineJointInvite: async (inviteId: number | string): Promise<unknown> =>
    apiCall(`/api/sharing/joint-sessions/invites/${inviteId}/decline`, {
      method: "POST",
    }),

  getJointSession: async (jointSessionId: string): Promise<any | null> => {
    const response = await authenticatedFetch(
      `/api/sharing/joint-sessions/${jointSessionId}`,
    )
    if (response.status === 404) return null
    const data: any = await parseApiResponse(response)
    return data.jointSession ?? data
  },

  pushJointProgress: async (
    jointSessionId: string,
    progress: unknown,
  ): Promise<unknown> =>
    apiCall(`/api/sharing/joint-sessions/${jointSessionId}/progress`, {
      method: "PATCH",
      body: JSON.stringify(progress),
    }),

  leaveJointSession: async (jointSessionId: string): Promise<unknown> =>
    apiCall(`/api/sharing/joint-sessions/${jointSessionId}/leave`, {
      method: "DELETE",
    }),

  getFriendActiveSession: async (
    friendId: number | string,
  ): Promise<any | null> => {
    const response = await authenticatedFetch(
      `/api/sharing/watch/friend/${friendId}/active`,
    )
    if (response.status === 404 || response.status === 403) return null
    const data: any = await parseApiResponse(response)
    return data.session ?? null
  },

  getFriendLiveSession: async (
    friendId: number | string,
    sessionId: number | string,
  ): Promise<any | null> => {
    const response = await authenticatedFetch(
      `/api/sharing/watch/friend/${friendId}/session/${sessionId}/live`,
    )
    if (response.status === 404 || response.status === 403) return null
    const data: any = await parseApiResponse(response)
    return data.liveSession ?? null
  },
}
