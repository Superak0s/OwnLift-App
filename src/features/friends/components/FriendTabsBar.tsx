import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { Friend } from "../services";
import type { ReceivedProgram } from "../types";
import type { makeStyles } from "../FriendsScreen";

interface FriendTabDescriptor {
  key: string;
  label: string;
  locked: boolean;
}

interface FriendTabsBarProps {
  readonly selectedFriend: Friend | null;
  readonly activeFriendTab: string;
  readonly hasFriendSharedAnalyticsWith: (
    friendId: number | string | undefined,
  ) => boolean;
  readonly receivedPrograms: ReceivedProgram[];
  readonly hasReceivedPermission: (
    friendId: number | string | undefined,
    type: string,
  ) => boolean;
  readonly onSelectTab: (tabKey: string) => void;
  readonly onLockedTab: (tabKey: string) => void;
  readonly styles: ReturnType<typeof makeStyles>;
}

export function FriendTabsBar({
  selectedFriend,
  activeFriendTab,
  hasFriendSharedAnalyticsWith,
  receivedPrograms,
  hasReceivedPermission,
  onSelectTab,
  onLockedTab,
  styles,
}: FriendTabsBarProps): React.JSX.Element {
  const hasAnalytics = hasFriendSharedAnalyticsWith(selectedFriend?.id);
  const hasProgramFromFriend = receivedPrograms.some(
    (p) => p.senderId === selectedFriend?.id,
  );
  const hasWatch = hasReceivedPermission(selectedFriend?.id, "watch_session");

  const tabs: FriendTabDescriptor[] = [
    { key: "history", label: "📅 History", locked: !hasAnalytics },
    { key: "analytics", label: "📊 Analytics", locked: !hasAnalytics },
    { key: "program", label: "📋 Program", locked: !hasProgramFromFriend },
    { key: "live", label: "🔴 Live", locked: !hasWatch },
    { key: "actions", label: "⚙️ Actions", locked: false },
  ];

  return (
    <View style={styles.friendTabContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.friendTab,
            activeFriendTab === tab.key && styles.friendTabActive,
            tab.locked && { opacity: 0.35 },
          ]}
          onPress={() =>
            tab.locked ? onLockedTab(tab.key) : onSelectTab(tab.key)
          }
        >
          <Text
            style={[
              styles.friendTabText,
              activeFriendTab === tab.key && styles.friendTabTextActive,
            ]}
            numberOfLines={1}
          >
            {tab.label}
            {tab.locked ? " 🔒" : ""}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
