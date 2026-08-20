import { apiCall, callWithLogging } from "@shared/services/apiClient"
import type {
  Friend,
  PendingFriendRequest,
  SentFriendRequest,
  UserSearchResult,
  ContactFriendSuggestion,
} from "../../types"

export const friendsApi = {
  searchUsers: async (
    query: string,
    limit: number = 10,
  ): Promise<UserSearchResult[]> =>
    callWithLogging("searchUsers", async () => {
      const params = new URLSearchParams({ q: query, limit: limit.toString() })
      const data = await apiCall<{ users: UserSearchResult[] }>(
        `/api/friends/search?${params.toString()}`,
      )
      return data.users
    }),

  suggestFriendsFromContacts: async (
    emailHashes: string[],
  ): Promise<ContactFriendSuggestion[]> =>
    callWithLogging("suggestFriendsFromContacts", async () => {
      if (emailHashes.length === 0) return []
      const data = await apiCall<{ suggestions: ContactFriendSuggestion[] }>(
        `/api/friends/suggest-from-contacts`,
        {
          method: "POST",
          body: JSON.stringify({ emailHashes }),
        },
      )
      return data.suggestions || []
    }),

  getFriends: async (): Promise<Friend[]> =>
    callWithLogging("getFriends", async () => {
      const data = await apiCall<{ friends: Record<string, unknown>[] }>(
        `/api/friends`,
      )
      return (data.friends || []).map((friend) => ({
        id: friend.friend_user_id as string | number,
        username: friend.username as string,
        name: friend.name as string,
        email: friend.email as string,
        createdAt: friend.friends_since as string,
      })) as Friend[]
    }),

  sendFriendRequest: async (username: string): Promise<unknown> =>
    callWithLogging("sendFriendRequest", async () =>
      apiCall(`/api/friends/request`, {
        method: "POST",
        body: JSON.stringify({ username }),
      })
    ),

  getPendingRequests: async (): Promise<PendingFriendRequest[]> =>
    callWithLogging("getPendingRequests", async () => {
      const data = await apiCall<{ requests: Record<string, unknown>[] }>(
        `/api/friends/requests/pending`,
      )
      return (data.requests || []).map((request) => ({
        id: request.friendship_id as string | number,
        senderId: request.user_id as string | number,
        senderUsername: request.username as string,
        senderName: request.name as string,
        createdAt: request.created_at as string,
      })) as PendingFriendRequest[]
    }),

  getSentRequests: async (): Promise<SentFriendRequest[]> =>
    callWithLogging("getSentRequests", async () => {
      const data = await apiCall<{ requests: Record<string, unknown>[] }>(
        `/api/friends/requests/sent`,
      )
      return (data.requests || []).map((request) => ({
        id: request.friendship_id as string | number,
        receiverId: request.friend_id as string | number,
        receiverUsername: request.username as string,
        receiverName: request.name as string,
        createdAt: request.created_at as string,
      })) as SentFriendRequest[]
    }),

  acceptFriendRequest: async (
    friendshipId: number | string,
  ): Promise<unknown> =>
    callWithLogging("acceptFriendRequest", async () =>
      apiCall(`/api/friends/request/${friendshipId}/accept`, { method: "POST" })
    ),

  rejectFriendRequest: async (
    friendshipId: number | string,
  ): Promise<unknown> =>
    callWithLogging("rejectFriendRequest", async () =>
      apiCall(`/api/friends/request/${friendshipId}/reject`, { method: "POST" })
    ),

  removeFriend: async (friendId: number | string): Promise<unknown> =>
    callWithLogging("removeFriend", async () =>
      apiCall(`/api/friends/${friendId}`, { method: "DELETE" })
    ),
}
