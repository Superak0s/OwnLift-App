import { createDispatchProxy } from "@shared/services/dispatchProxy"
import { friendsApi as friendsApiOn } from "./on/friends"
import { friendsApi as friendsApiOff } from "./off/friends"
import { sharingApi as sharingApiOn } from "./on/sharing"
import { sharingApi as sharingApiOff } from "./off/sharing"

type FriendsApiShape = typeof friendsApiOn
type SharingApiShape = typeof sharingApiOn

export const friendsApi: FriendsApiShape = createDispatchProxy(
  friendsApiOn,
  friendsApiOff,
)

export const sharingApi: SharingApiShape = createDispatchProxy(
  sharingApiOn,
  sharingApiOff,
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
