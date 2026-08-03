// src/features/friends/widgets.ts
//
// Friends-screen widget config. Like Tracking, each top-level tab —
// Friends / Requests / Search — keeps its own independent, add/remove/
// resize/reorder widget board, using the same shared
// WidgetsPanel/WidgetGallery/useWidgets machinery as Home and Tracking,
// just instantiated once per tab.
//
// The friend-detail modal (history / analytics / program / live / actions)
// is intentionally left out of this — it's a per-friend inspector, not a
// dashboard, and it hosts ExerciseAnalytics/LiveSessionTab as-is.

import { STORAGE_KEYS } from "@shared/services/storage"
import type { WidgetDefinition, WidgetInstance } from "@shared/types"

export const FRIENDS_TABS = [
  { key: "friends", icon: "👥", label: "Friends" },
  { key: "requests", icon: "📬", label: "Requests" },
  { key: "search", icon: "🔍", label: "Search" },
]

// ─── Friends tab ────────────────────────────────────────────────────────────

export type FriendsWidgetType = "friends_list"

export const FRIENDS_WIDGET_REGISTRY: Record<
  FriendsWidgetType,
  WidgetDefinition<FriendsWidgetType>
> = {
  friends_list: {
    type: "friends_list",
    title: "Your Friends",
    description:
      "Everyone you're connected with, and who's working out right now",
    icon: "👥",
    availableSizes: ["large"],
    defaultSize: "large",
    singleton: true,
  },
}

export const DEFAULT_FRIENDS_WIDGETS: WidgetInstance<FriendsWidgetType>[] = [
  {
    id: "default-friends-list",
    type: "friends_list",
    size: "large",
    order: 0,
  },
]

export const FRIENDS_WIDGETS_STORAGE_KEY = STORAGE_KEYS.FRIENDS_TAB_WIDGETS

// ─── Requests tab ───────────────────────────────────────────────────────────

export type RequestsWidgetType = "requests_pending" | "requests_sent"

export const REQUESTS_WIDGET_REGISTRY: Record<
  RequestsWidgetType,
  WidgetDefinition<RequestsWidgetType>
> = {
  requests_pending: {
    type: "requests_pending",
    title: "Pending Requests",
    description: "Friend requests waiting on your response",
    icon: "📬",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  requests_sent: {
    type: "requests_sent",
    title: "Sent Requests",
    description: "Friend requests you've sent that are still pending",
    icon: "📤",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
}

export const DEFAULT_REQUESTS_WIDGETS: WidgetInstance<RequestsWidgetType>[] = [
  {
    id: "default-requests-pending",
    type: "requests_pending",
    size: "large",
    order: 0,
  },
  {
    id: "default-requests-sent",
    type: "requests_sent",
    size: "large",
    order: 1,
  },
]

export const REQUESTS_WIDGETS_STORAGE_KEY = STORAGE_KEYS.REQUESTS_TAB_WIDGETS

// ─── Search tab ─────────────────────────────────────────────────────────────

export type SearchWidgetType = "search_contacts" | "search_qr" | "search_users"

export const SEARCH_WIDGET_REGISTRY: Record<
  SearchWidgetType,
  WidgetDefinition<SearchWidgetType>
> = {
  search_contacts: {
    type: "search_contacts",
    title: "Friends from Contacts",
    description: "Match your contacts against the app using hashed emails only",
    icon: "📱",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
  search_qr: {
    type: "search_qr",
    title: "Add via QR Code",
    description: "Show your code or scan a friend's to add them instantly",
    icon: "🔳",
    availableSizes: ["medium", "large"],
    defaultSize: "medium",
    singleton: true,
  },
  search_users: {
    type: "search_users",
    title: "Search by Username",
    description: "Look up a user by username and send a friend request",
    icon: "🔍",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
}

export const DEFAULT_SEARCH_WIDGETS: WidgetInstance<SearchWidgetType>[] = [
  {
    id: "default-search-contacts",
    type: "search_contacts",
    size: "large",
    order: 0,
  },
  {
    id: "default-search-qr",
    type: "search_qr",
    size: "medium",
    order: 1,
  },
  {
    id: "default-search-users",
    type: "search_users",
    size: "large",
    order: 2,
  },
]

export const SEARCH_WIDGETS_STORAGE_KEY = STORAGE_KEYS.SEARCH_TAB_WIDGETS

// NOTE: add these three entries to STORAGE_KEYS in @shared/services/storage
// (next to HOME_WIDGETS and the tracking-tab widget keys) the same way
// tracking's storage keys are wired up, e.g.:
//   FRIENDS_TAB_WIDGETS: "friendsScreen_friendsWidgets",
//   REQUESTS_TAB_WIDGETS: "friendsScreen_requestsWidgets",
//   SEARCH_TAB_WIDGETS: "friendsScreen_searchWidgets",
