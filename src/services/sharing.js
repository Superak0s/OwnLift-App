import { getServerUrl } from "./config"
import { authenticatedFetch } from "./auth"

/**
 * Sharing API - Implements documented endpoints
 * Routes are registered under /api/sharing/
 */
export const sharingApi = {
  /**
   * Share analytics with a friend
   * POST /api/sharing/analytics
   */
  shareAnalytics: async (
    friendId,
    includeAllSessions = true,
    dayNumber = null,
    message = null,
  ) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/analytics`,
        {
          method: "POST",
          body: JSON.stringify({
            friendId,
            includeAllSessions,
            dayNumber,
            message,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to share analytics")
      }

      return data
    } catch (error) {
      console.error("Error sharing analytics:", error)
      throw error
    }
  },

  /**
   * Get received analytics shares
   * GET /api/sharing/analytics/received
   */
  getReceivedAnalytics: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/analytics/received`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get received analytics")
      }

      // Map backend field names to frontend expected names
      return (data.shares || []).map((share) => ({
        id: share.id,
        senderId: share.from_user_id,
        senderUsername: share.from_username,
        senderName: share.from_name,
        sharedAt: share.created_at,
        message: share.message,
        includeAllSessions: share.include_all_sessions,
        dayNumber: share.include_day_number,
      }))
    } catch (error) {
      console.error("Error getting received analytics:", error)
      throw error
    }
  },

  /**
   * Get sent analytics shares
   * GET /api/sharing/analytics/sent
   */
  getSentAnalytics: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/analytics/sent`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get sent analytics")
      }

      // Map backend field names to frontend expected names
      return (data.shares || []).map((share) => ({
        id: share.id,
        receiverId: share.to_user_id,
        receiverUsername: share.to_username,
        receiverName: share.to_name,
        sharedAt: share.created_at,
        message: share.message,
        includeAllSessions: share.include_all_sessions,
        dayNumber: share.include_day_number,
      }))
    } catch (error) {
      console.error("Error getting sent analytics:", error)
      throw error
    }
  },

  /**
   * View friend's analytics
   * GET /api/sharing/analytics/:shareId/view
   */
  viewFriendAnalytics: async (shareId, friendId) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/analytics/${shareId}/view?friendId=${friendId}`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to view friend analytics")
      }

      return data.analytics
    } catch (error) {
      console.error("Error viewing friend analytics:", error)
      throw error
    }
  },

  /**
   * Get friend's workout sessions
   * GET /api/sharing/sessions/friend/:friendId
   */
  getFriendSessions: async (friendId, limit = 60) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/sessions/friend/${friendId}?limit=${limit}`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get friend sessions")
      }

      return data.sessions || []
    } catch (error) {
      console.error("Error getting friend sessions:", error)
      throw error
    }
  },

  /**
   * Get friend's workout session details
   * GET /api/sharing/sessions/friend/:friendId/:sessionId
   */
  getFriendSessionDetails: async (friendId, sessionId) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/sessions/friend/${friendId}/${sessionId}`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get friend session details")
      }

      return data.session || null
    } catch (error) {
      console.error("Error getting friend session details:", error)
      throw error
    }
  },

  /**
   * Share program with a friend
   * POST /api/sharing/program
   */
  shareProgram: async (friendId, programData, message = null) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/program`,
        {
          method: "POST",
          body: JSON.stringify({
            friendId,
            programData,
            message,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to share program")
      }

      return data
    } catch (error) {
      console.error("Error sharing program:", error)
      throw error
    }
  },

  /**
   * Get received programs
   * GET /api/sharing/program/received
   */
  getReceivedPrograms: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/program/received`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get received programs")
      }

      return (data.programs || []).map((program) => ({
        id: program.id,
        senderId: program.from_user_id,
        senderUsername: program.from_username,
        senderName: program.from_name,
        sharedAt: program.created_at,
        message: program.message,
        programData: program.program_data,
        accepted: program.accepted,
        acceptedAt: program.accepted_at,
      }))
    } catch (error) {
      console.error("Error getting received programs:", error)
      throw error
    }
  },

  /**
   * Get sent programs
   * GET /api/sharing/program/sent
   */
  getSentPrograms: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/program/sent`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get sent programs")
      }

      // Map backend field names to frontend expected names
      return (data.programs || []).map((program) => ({
        id: program.id,
        receiverId: program.to_user_id,
        receiverUsername: program.to_username,
        receiverName: program.to_name,
        sharedAt: program.created_at,
        message: program.message,
        programData: program.program_data,
        accepted: program.accepted,
        acceptedAt: program.accepted_at,
      }))
    } catch (error) {
      console.error("Error getting sent programs:", error)
      throw error
    }
  },

  /**
   * Accept shared program
   * POST /api/sharing/program/:shareId/accept
   */
  acceptProgram: async (shareId) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/program/${shareId}/accept`,
        {
          method: "POST",
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to accept program")
      }

      return data
    } catch (error) {
      console.error("Error accepting program:", error)
      throw error
    }
  },

  /**
   * Delete a share (analytics or program)
   * DELETE /api/sharing/:shareType/:shareId
   */
  deleteShare: async (shareType, shareId) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/${shareType}/${shareId}`,
        {
          method: "DELETE",
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete share")
      }

      return data
    } catch (error) {
      console.error("Error deleting share:", error)
      throw error
    }
  },

  /**
   * Get sharing statistics
   * GET /api/sharing/stats
   */
  getSharingStats: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sharing/stats`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get sharing stats")
      }

      return data.stats
    } catch (error) {
      console.error("Error getting sharing stats:", error)
      throw error
    }
  },
}
