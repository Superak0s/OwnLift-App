import { getServerUrl } from "./config"
import { authenticatedFetch } from "./auth"

/**
 * Friends API - Implements documented endpoints
 */
export const friendsApi = {
  /**
   * Search for users
   * GET /api/friends/search
   */
  searchUsers: async (query, limit = 10) => {
    try {
      const API_BASE_URL = getServerUrl()
      const params = new URLSearchParams({ q: query, limit: limit.toString() })
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/friends/search?${params.toString()}`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to search users")
      }

      return data.users
    } catch (error) {
      console.error("Error searching users:", error)
      throw error
    }
  },

  /**
   * Get all friends
   * GET /api/friends
   */
  getFriends: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(`${API_BASE_URL}/api/friends`)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get friends")
      }

      // Map backend field names to frontend expected names
      return (data.friends || []).map((friend) => ({
        id: friend.friend_user_id,
        username: friend.username,
        name: friend.name,
        email: friend.email,
        createdAt: friend.friends_since,
      }))
    } catch (error) {
      console.error("Error getting friends:", error)
      throw error
    }
  },

  /**
   * Send friend request
   * POST /api/friends/request
   */
  sendFriendRequest: async (username) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/friends/request`,
        {
          method: "POST",
          body: JSON.stringify({ username }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send friend request")
      }

      return data
    } catch (error) {
      console.error("Error sending friend request:", error)
      throw error
    }
  },

  /**
   * Get pending friend requests
   * GET /api/friends/requests/pending
   */
  getPendingRequests: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/friends/requests/pending`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get pending requests")
      }

      // Map backend field names to frontend expected names
      return (data.requests || []).map((request) => ({
        id: request.friendship_id,
        senderId: request.user_id,
        senderUsername: request.username,
        senderName: request.name,
        createdAt: request.created_at,
      }))
    } catch (error) {
      console.error("Error getting pending requests:", error)
      throw error
    }
  },

  /**
   * Get sent friend requests
   * GET /api/friends/requests/sent
   */
  getSentRequests: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/friends/requests/sent`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get sent requests")
      }

      // Map backend field names to frontend expected names
      return (data.requests || []).map((request) => ({
        id: request.friendship_id,
        receiverId: request.friend_id,
        receiverUsername: request.username,
        receiverName: request.name,
        createdAt: request.created_at,
      }))
    } catch (error) {
      console.error("Error getting sent requests:", error)
      throw error
    }
  },

  /**
   * Accept friend request
   * POST /api/friends/request/:friendshipId/accept
   */
  acceptFriendRequest: async (friendshipId) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/friends/request/${friendshipId}/accept`,
        {
          method: "POST",
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to accept friend request")
      }

      return data
    } catch (error) {
      console.error("Error accepting friend request:", error)
      throw error
    }
  },

  /**
   * Reject friend request
   * POST /api/friends/request/:friendshipId/reject
   */
  rejectFriendRequest: async (friendshipId) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/friends/request/${friendshipId}/reject`,
        {
          method: "POST",
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject friend request")
      }

      return data
    } catch (error) {
      console.error("Error rejecting friend request:", error)
      throw error
    }
  },

  /**
   * Remove friend
   * DELETE /api/friends/:friendId
   */
  removeFriend: async (friendId) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/friends/${friendId}`,
        {
          method: "DELETE",
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove friend")
      }

      return data
    } catch (error) {
      console.error("Error removing friend:", error)
      throw error
    }
  },
}
