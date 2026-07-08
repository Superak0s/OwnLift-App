// services/qrFriendCode.ts

/**
 * Namespacing tag embedded in every QR code this app generates, so that
 * scanning a random/unrelated QR code (a URL, a wifi code, etc.) is safely
 * ignored instead of being misread as a friend-add attempt.
 */
export const FRIEND_QR_TYPE = "gymapp_friend_v1"

export interface FriendQrPayload {
  type: typeof FRIEND_QR_TYPE
  id: number | string
  username: string
}

/**
 * Builds the JSON string that gets encoded into a user's "My QR Code".
 * Scanning it and passing the raw text to parseFriendQrPayload recovers
 * the id/username needed to send a friend request.
 */
export function buildFriendQrPayload(
  id: number | string,
  username: string,
): string {
  const payload: FriendQrPayload = { type: FRIEND_QR_TYPE, id, username }
  return JSON.stringify(payload)
}

/**
 * Parses raw scanned QR text into a FriendQrPayload.
 * Returns null if the QR code isn't one of ours, or is malformed, so the
 * caller can show a friendly "not a friend code" message rather than crash.
 */
export function parseFriendQrPayload(raw: string): FriendQrPayload | null {
  try {
    const data = JSON.parse(raw)
    if (
      data &&
      data.type === FRIEND_QR_TYPE &&
      typeof data.username === "string" &&
      data.username.trim().length > 0
    ) {
      return {
        type: FRIEND_QR_TYPE,
        id: data.id,
        username: data.username,
      }
    }
    return null
  } catch {
    return null
  }
}
