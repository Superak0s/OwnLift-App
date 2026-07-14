// features/friends/services/qrFriendCode.tsx

export const FRIEND_QR_TYPE = "gymapp_friend_v1"

export interface FriendQrPayload {
  type: typeof FRIEND_QR_TYPE
  id: number | string
  username: string
}

export function buildFriendQrPayload(
  id: number | string,
  username: string,
): string {
  const payload: FriendQrPayload = { type: FRIEND_QR_TYPE, id, username }
  return JSON.stringify(payload)
}

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
