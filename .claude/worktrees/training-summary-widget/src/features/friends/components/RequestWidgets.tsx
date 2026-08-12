import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { formatDate } from "@utils/format";
import type { PendingFriendRequest, SentFriendRequest } from "../services";
import type { makeStyles } from "../FriendsScreen";

interface RequestsPendingWidgetProps {
  readonly pendingRequests: PendingFriendRequest[];
  readonly styles: ReturnType<typeof makeStyles>;
  readonly onAccept: (friendshipId: number | string) => void;
  readonly onReject: (friendshipId: number | string, username: string) => void;
}

export function RequestsPendingWidget({
  pendingRequests,
  styles,
  onAccept,
  onReject,
}: RequestsPendingWidgetProps): React.JSX.Element {
  return (
    <View>
      <Text style={styles.subsectionTitle}>
        Pending Requests ({pendingRequests.length})
      </Text>
      {pendingRequests.length === 0 ? (
        <View style={styles.emptyStateSmall}>
          <Text style={styles.emptyTextSmall}>No pending friend requests</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {pendingRequests.map((request) => (
            <View key={String(request.id)} style={styles.requestCard}>
              <View style={styles.friendInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {request.senderUsername?.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.friendDetails}>
                  <Text style={styles.friendName}>
                    {request.senderUsername}
                  </Text>
                  <Text style={styles.friendMeta}>
                    Sent {formatDate(request.createdAt)}
                  </Text>
                </View>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => onAccept(request.id)}
                >
                  <Text style={styles.acceptButtonText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => onReject(request.id, request.senderUsername)}
                >
                  <Text style={styles.rejectButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface RequestsSentWidgetProps {
  readonly sentRequests: SentFriendRequest[];
  readonly styles: ReturnType<typeof makeStyles>;
}

export function RequestsSentWidget({
  sentRequests,
  styles,
}: RequestsSentWidgetProps): React.JSX.Element {
  return (
    <View>
      <Text style={styles.subsectionTitle}>
        Sent Requests ({sentRequests.length})
      </Text>
      {sentRequests.length === 0 ? (
        <View style={styles.emptyStateSmall}>
          <Text style={styles.emptyTextSmall}>No sent friend requests</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {sentRequests.map((request) => (
            <View key={String(request.id)} style={styles.sentRequestCard}>
              <View style={styles.friendInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {request.receiverUsername?.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.friendDetails}>
                  <Text style={styles.friendName}>
                    {request.receiverUsername}
                  </Text>
                  <Text style={styles.friendMeta}>
                    Sent {formatDate(request.createdAt)}
                  </Text>
                </View>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>Pending</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
