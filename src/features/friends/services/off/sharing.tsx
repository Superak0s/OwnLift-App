import { offlineUnsupported } from "@shared/services/offlineHelpers"
import type {
  PermissionType,
  JointInviteParams,
  GrantedPermission,
  ReceivedPermission,
  ReceivedProgram,
  SentProgram,
} from "../../types"

/**
 * Offline Sharing API — sharing, permissions, and joint/watch sessions are
 * inherently multi-user, server-mediated features. None of this has a
 * meaningful offline equivalent, so every method surfaces a friendly
 * "not available offline" error via offlineUnsupported.
 */
export const sharingApi = {
  grantPermission: async (
    _friendId: number | string,
    _permissionType: PermissionType,
    _payload: Record<string, unknown> | null = null,
  ): Promise<unknown> => offlineUnsupported("Sharing with friends"),

  revokePermission: async (_permissionId: number | string): Promise<unknown> =>
    offlineUnsupported("Revoking shared permissions"),

  getGrantedPermissions: async (): Promise<GrantedPermission[]> =>
    offlineUnsupported("Viewing granted permissions"),

  getReceivedPermissions: async (): Promise<ReceivedPermission[]> =>
    offlineUnsupported("Viewing received permissions"),

  shareAnalytics: async (
    _friendId: number | string,
    _includeAllSessions: unknown,
    _dayNumber: unknown,
    _message: string | null = null,
  ): Promise<unknown> => offlineUnsupported("Sharing analytics"),

  getReceivedAnalytics: async (): Promise<unknown[]> =>
    offlineUnsupported("Viewing received analytics"),

  getSentAnalytics: async (): Promise<unknown[]> =>
    offlineUnsupported("Viewing sent analytics"),

  viewFriendAnalytics: async (
    _shareId: unknown,
    _friendId: number | string,
  ): Promise<unknown> => offlineUnsupported("Viewing a friend's analytics"),

  shareProgram: async (
    _friendId: number | string,
    _programData: unknown,
    _message: string | null = null,
  ): Promise<unknown> => offlineUnsupported("Sharing your program"),

  getReceivedPrograms: async (): Promise<ReceivedProgram[]> =>
    offlineUnsupported("Viewing received programs"),

  getSentPrograms: async (): Promise<SentProgram[]> =>
    offlineUnsupported("Viewing sent programs"),

  deleteShare: async (
    _shareType: string,
    _permissionId: number | string,
  ): Promise<unknown> => offlineUnsupported("Deleting a share"),

  getFriendSessions: async (
    _friendId: number | string,
    _limit: number = 60,
  ): Promise<unknown[]> => offlineUnsupported("Viewing a friend's sessions"),

  getFriendSessionDetails: async (
    _friendId: number | string,
    _sessionId: number | string,
  ): Promise<unknown | null> =>
    offlineUnsupported("Viewing friend session details"),

  getSharingStats: async (): Promise<unknown> =>
    offlineUnsupported("Viewing sharing stats"),

  getFriendSessionStatus: async (
    _friendId: number | string,
  ): Promise<{ hasActiveSession: boolean } | unknown> =>
    offlineUnsupported("Checking a friend's session status"),

  sendJointInvite: async (_params: JointInviteParams): Promise<unknown> =>
    offlineUnsupported("Sending joint session invites"),

  getInviteStatus: async (
    _inviteId: number | string,
  ): Promise<unknown | null> => offlineUnsupported("Checking invite status"),

  getMyPendingInvite: async (): Promise<unknown | null> =>
    offlineUnsupported("Checking pending invites"),

  acceptJointInvite: async (_inviteId: number | string): Promise<unknown> =>
    offlineUnsupported("Accepting joint session invites"),

  declineJointInvite: async (_inviteId: number | string): Promise<unknown> =>
    offlineUnsupported("Declining joint session invites"),

  getJointSession: async (_jointSessionId: string): Promise<unknown | null> =>
    offlineUnsupported("Joint sessions"),

  pushJointProgress: async (
    _jointSessionId: string,
    _progress: unknown,
  ): Promise<unknown> => offlineUnsupported("Joint sessions"),

  leaveJointSession: async (_jointSessionId: string): Promise<unknown> =>
    offlineUnsupported("Joint sessions"),

  getFriendActiveSession: async (
    _friendId: number | string,
  ): Promise<unknown | null> =>
    offlineUnsupported("Watching a friend's session"),

  getFriendLiveSession: async (
    _friendId: number | string,
    _sessionId: number | string,
  ): Promise<unknown | null> =>
    offlineUnsupported("Watching a friend's live session"),
}
