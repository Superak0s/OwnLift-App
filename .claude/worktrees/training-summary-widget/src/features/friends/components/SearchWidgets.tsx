import React from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import type { ThemeColors } from "@shared/context/ThemeContext";
import type {
  Friend,
  ContactFriendSuggestion,
  PendingFriendRequest,
  SentFriendRequest,
} from "../services";
import type { UserSearchResult } from "../types";
import type { makeStyles } from "../FriendsScreen";
import type { makePermStyles } from "./PermissionRow";

type IdOrNull = number | string | null;
type IdOrUndefined = number | string | undefined;

interface SearchContactsWidgetProps {
  readonly styles: ReturnType<typeof makeStyles>;
  readonly permStyles: ReturnType<typeof makePermStyles>;
  readonly colors: ThemeColors;
  readonly loadingContactSuggestions: boolean;
  readonly contactPermissionDenied: boolean;
  readonly contactSuggestionsRequested: boolean;
  readonly contactSuggestions: ContactFriendSuggestion[];
  readonly sendingRequestTo: IdOrNull;
  readonly onFindSuggestions: () => void;
  readonly onSendRequest: (suggestion: ContactFriendSuggestion) => void;
}

export function SearchContactsWidget({
  styles,
  permStyles,
  colors,
  loadingContactSuggestions,
  contactPermissionDenied,
  contactSuggestionsRequested,
  contactSuggestions,
  sendingRequestTo,
  onFindSuggestions,
  onSendRequest,
}: SearchContactsWidgetProps): React.JSX.Element {
  const showNoneFound =
    !contactPermissionDenied &&
    contactSuggestionsRequested &&
    !loadingContactSuggestions &&
    contactSuggestions.length === 0;

  return (
    <View>
      <View style={permStyles.row}>
        <Text style={permStyles.icon}>📱</Text>
        <View style={permStyles.text}>
          <Text style={permStyles.title}>Friends from Contacts</Text>
          <Text style={permStyles.desc}>
            We'll ask for contacts access and only send hashed emails — never
            raw contact info — to check for matches.
          </Text>
        </View>
        {loadingContactSuggestions ? (
          <ActivityIndicator
            size='small'
            color={colors.accent}
            style={{ marginLeft: 8 }}
          />
        ) : (
          <TouchableOpacity
            style={permStyles.grantBtn}
            onPress={onFindSuggestions}
          >
            <Text style={permStyles.grantBtnText}>Check</Text>
          </TouchableOpacity>
        )}
      </View>

      {contactPermissionDenied && (
        <View style={styles.emptyStateSmall}>
          <Text style={styles.emptyTextSmall}>
            Contacts access was denied. You can enable it in your device
            settings to see friend suggestions.
          </Text>
        </View>
      )}

      {showNoneFound && (
        <View style={styles.emptyStateSmall}>
          <Text style={styles.emptyTextSmall}>
            No contacts found on this app yet.
          </Text>
        </View>
      )}

      {contactSuggestions.length > 0 && (
        <View style={styles.listContainer}>
          {contactSuggestions.map((suggestion) => (
            <View key={String(suggestion.id)} style={styles.searchResultCard}>
              <View style={styles.friendInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {suggestion.username?.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.friendDetails}>
                  <Text style={styles.friendName}>{suggestion.username}</Text>
                  <Text style={styles.friendMeta}>From contacts</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => onSendRequest(suggestion)}
                disabled={sendingRequestTo === suggestion.id}
              >
                {sendingRequestTo === suggestion.id ? (
                  <ActivityIndicator size='small' color={colors.textOnAccent} />
                ) : (
                  <Text style={styles.addButtonText}>+ Add Friend</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface SearchQrWidgetProps {
  readonly permStyles: ReturnType<typeof makePermStyles>;
  readonly onShowMyQr: () => void;
  readonly onScanQr: () => void;
}

export function SearchQrWidget({
  permStyles,
  onShowMyQr,
  onScanQr,
}: SearchQrWidgetProps): React.JSX.Element {
  return (
    <View style={permStyles.row}>
      <Text style={permStyles.icon}>🔳</Text>
      <View style={permStyles.text}>
        <Text style={permStyles.title}>Add via QR Code</Text>
        <Text style={permStyles.desc}>
          Show your code for a friend to scan, or scan theirs to add them
          instantly.
        </Text>
      </View>
      <TouchableOpacity style={permStyles.grantBtn} onPress={onShowMyQr}>
        <Text style={permStyles.grantBtnText}>My Code</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[permStyles.grantBtn, { marginLeft: 8 }]}
        onPress={onScanQr}
      >
        <Text style={permStyles.grantBtnText}>Scan</Text>
      </TouchableOpacity>
    </View>
  );
}

interface SearchUsersWidgetProps {
  readonly styles: ReturnType<typeof makeStyles>;
  readonly colors: ThemeColors;
  readonly searchQuery: string;
  readonly onChangeQuery: (text: string) => void;
  readonly searching: boolean;
  readonly searchResults: UserSearchResult[];
  readonly friends: Friend[];
  readonly sentRequests: SentFriendRequest[];
  readonly pendingRequests: PendingFriendRequest[];
  readonly currentUserId: IdOrUndefined;
  readonly onGoToRequests: () => void;
  readonly onAddFriend: (username: string) => void;
}

function SearchUserResultRow({
  result,
  friends,
  sentRequests,
  pendingRequests,
  currentUserId,
  styles,
  onGoToRequests,
  onAddFriend,
}: {
  readonly result: UserSearchResult;
  readonly friends: Friend[];
  readonly sentRequests: SentFriendRequest[];
  readonly pendingRequests: PendingFriendRequest[];
  readonly currentUserId: IdOrUndefined;
  readonly styles: ReturnType<typeof makeStyles>;
  readonly onGoToRequests: () => void;
  readonly onAddFriend: (username: string) => void;
}): React.JSX.Element {
  const isFriend = friends.some((f) => f.id === result.id);
  const hasSent = sentRequests.some((r) => r.receiverId === result.id);
  const hasPending = pendingRequests.some((r) => r.senderId === result.id);

  let action: React.ReactNode;
  if (result.id === currentUserId) {
    action = (
      <View style={styles.statusBadge}>
        <Text style={styles.statusBadgeText}>You</Text>
      </View>
    );
  } else if (isFriend) {
    action = (
      <View style={[styles.statusBadge, styles.statusBadgeFriend]}>
        <Text style={styles.statusBadgeText}>✓ Friends</Text>
      </View>
    );
  } else if (hasSent) {
    action = (
      <View style={styles.statusBadge}>
        <Text style={styles.statusBadgeText}>Pending</Text>
      </View>
    );
  } else if (hasPending) {
    action = (
      <TouchableOpacity style={styles.respondButton} onPress={onGoToRequests}>
        <Text style={styles.respondButtonText}>Respond</Text>
      </TouchableOpacity>
    );
  } else {
    action = (
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => onAddFriend(result.username)}
      >
        <Text style={styles.addButtonText}>+ Add Friend</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.searchResultCard}>
      <View style={styles.friendInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {result.username?.charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{result.username}</Text>
          {result.email && (
            <Text style={styles.friendMeta}>{result.email}</Text>
          )}
        </View>
      </View>
      <View style={styles.searchResultActions}>{action}</View>
    </View>
  );
}

export function SearchUsersWidget({
  styles,
  colors,
  searchQuery,
  onChangeQuery,
  searching,
  searchResults,
  friends,
  sentRequests,
  pendingRequests,
  currentUserId,
  onGoToRequests,
  onAddFriend,
}: SearchUsersWidgetProps): React.JSX.Element {
  const noResults =
    searchQuery.trim() && !searching && searchResults.length === 0 ? (
      <View style={styles.emptyStateSmall}>
        <Text style={styles.emptyTextSmall}>No users found</Text>
      </View>
    ) : null;
  return (
    <View>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder='Search by username...'
          value={searchQuery}
          onChangeText={onChangeQuery}
          autoCapitalize='none'
          autoCorrect={false}
        />
        {searching && (
          <ActivityIndicator
            style={styles.searchLoader}
            size='small'
            color={colors.accent}
          />
        )}
      </View>
      {searchResults.length > 0 ? (
        <View style={styles.listContainer}>
          {searchResults.map((result) => (
            <SearchUserResultRow
              key={String(result.id)}
              result={result}
              friends={friends}
              sentRequests={sentRequests}
              pendingRequests={pendingRequests}
              currentUserId={currentUserId}
              styles={styles}
              onGoToRequests={onGoToRequests}
              onAddFriend={onAddFriend}
            />
          ))}
        </View>
      ) : (
        noResults
      )}
    </View>
  );
}
