import { createDispatchProxy } from "@shared/services/dispatchProxy"
import { friendsApi as friendsApiOn } from "./on/friends"
import { sharingApi as sharingApiOn } from "./on/sharing"

type FriendsApiShape = typeof friendsApiOn
type SharingApiShape = typeof sharingApiOn

export const friendsApi: FriendsApiShape = createDispatchProxy(
  friendsApiOn,
  friendsApiOn,
)

export const sharingApi: SharingApiShape = createDispatchProxy(
  sharingApiOn,
  sharingApiOn,
)

export {
  requestContactsPermission,
  getHashedContactEmails,
  collectHashedContactEmails,
} from "./contactsMatching"
export type {
  ContactsPermissionResult,
  ContactSuggestionsResult,
} from "./contactsMatching"

export {
  FRIEND_QR_TYPE,
  buildFriendQrPayload,
  parseFriendQrPayload,
} from "./qrFriendCode"
export type { FriendQrPayload } from "./qrFriendCode"

export type {
  Friend,
  ReceivedProgram,
  SentProgram,
  PendingFriendRequest,
  SentFriendRequest,
  UserSearchResult,
  ContactFriendSuggestion,
  PermissionType,
  GrantedPermission,
  ReceivedPermission,
  JointInviteParams,
} from "../types"
