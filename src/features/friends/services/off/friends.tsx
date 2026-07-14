// features/friends/services/off/friends.tsx
import { offlineUnsupported } from "@shared/services/offlineHelpers"
import type {
  Friend,
  PendingFriendRequest,
  SentFriendRequest,
  UserSearchResult,
  ContactFriendSuggestion,
} from "../../types"

/**
 * Offline Friends API — friends/social features require a server (there's
 * no meaningful "local friends list" without one), so every method just
 * surfaces a friendly "not available offline" error via offlineUnsupported.
 */
export const friendsApi = {
  searchUsers: async (
    _query: string,
    _limit: number = 10,
  ): Promise<UserSearchResult[]> => offlineUnsupported("Searching for users"),

  suggestFriendsFromContacts: async (
    _emailHashes: string[],
  ): Promise<ContactFriendSuggestion[]> =>
    offlineUnsupported("Contact-based friend suggestions"),

  getFriends: async (): Promise<Friend[]> =>
    offlineUnsupported("Viewing friends"),

  sendFriendRequest: async (_username: string): Promise<unknown> =>
    offlineUnsupported("Sending friend requests"),

  getPendingRequests: async (): Promise<PendingFriendRequest[]> =>
    offlineUnsupported("Viewing pending friend requests"),

  getSentRequests: async (): Promise<SentFriendRequest[]> =>
    offlineUnsupported("Viewing sent friend requests"),

  acceptFriendRequest: async (
    _friendshipId: number | string,
  ): Promise<unknown> => offlineUnsupported("Accepting friend requests"),

  rejectFriendRequest: async (
    _friendshipId: number | string,
  ): Promise<unknown> => offlineUnsupported("Rejecting friend requests"),

  removeFriend: async (_friendId: number | string): Promise<unknown> =>
    offlineUnsupported("Removing friends"),
}
