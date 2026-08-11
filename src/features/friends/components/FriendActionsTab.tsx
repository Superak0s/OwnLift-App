import React from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import type { ThemeColors } from "@shared/context/ThemeContext";
import type { Friend, GrantedPermission } from "../services";
import type { makeStyles, makeWatchStyles, makeJointStyles } from "../FriendsScreen";
import { FriendGrantedPermissions, FriendReceivedPermissions } from "./FriendPermissions";

interface LiveSessionActionProps {
  readonly selectedFriend: Friend | null;
  readonly friendSessionStatuses: Record<string | number, boolean>;
  readonly isWatching: boolean;
  readonly watchTarget: { friendId?: string } | null;
  readonly checkingActiveSession: boolean;
  readonly onWatch: (friend: Friend) => void;
  readonly onStopWatching: () => void;
  readonly styles: ReturnType<typeof makeStyles>;
  readonly watchStyles: ReturnType<typeof makeWatchStyles>;
  readonly colors: ThemeColors;
}

function LiveSessionAction({
  selectedFriend,
  friendSessionStatuses,
  isWatching,
  watchTarget,
  checkingActiveSession,
  onWatch,
  onStopWatching,
  styles,
  watchStyles,
  colors,
}: LiveSessionActionProps): React.JSX.Element {
  const friendActive =
    !!friendSessionStatuses[selectedFriend?.id as number | string];
  const alreadyWatchingThis =
    isWatching && watchTarget?.friendId === String(selectedFriend?.id);

  return (
    <>
      <Text style={[styles.actionsTabSectionTitle, { marginTop: 28 }]}>
        Live Session
      </Text>
      {alreadyWatchingThis && (
        <View style={[styles.actionRow, watchStyles.activeRow]}>
          <Text style={styles.actionRowIcon}>👀</Text>
          <View style={styles.actionRowText}>
            <Text style={[styles.actionRowTitle, { color: colors.info }]}>
              Watching Now
            </Text>
            <Text style={styles.actionRowSub}>
              Switch to the Workout tab to see {selectedFriend?.username}'s live
              session.
            </Text>
          </View>
          <TouchableOpacity
            style={watchStyles.stopBtn}
            onPress={onStopWatching}
          >
            <Text style={watchStyles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}
      {!alreadyWatchingThis && !friendActive && (
        <View style={[styles.actionRow, { opacity: 0.55 }]}>
          <Text style={styles.actionRowIcon}>👀</Text>
          <View style={styles.actionRowText}>
            <Text style={styles.actionRowTitle}>View Current Session</Text>
            <Text style={styles.actionRowSub}>
              {selectedFriend?.username} isn't working out right now.
            </Text>
          </View>
        </View>
      )}
      {!alreadyWatchingThis && friendActive && (
        <TouchableOpacity
          style={[
            styles.actionRow,
            watchStyles.availableRow,
            checkingActiveSession && { opacity: 0.7 },
          ]}
          onPress={() => selectedFriend && onWatch(selectedFriend)}
          disabled={checkingActiveSession}
          activeOpacity={0.7}
        >
          <Text style={styles.actionRowIcon}>👀</Text>
          <View style={styles.actionRowText}>
            <Text style={[styles.actionRowTitle, { color: colors.info }]}>
              View Current Session
            </Text>
            <Text style={styles.actionRowSub}>
              {selectedFriend?.username} is working out now — watch their
              session live.
            </Text>
          </View>
          {checkingActiveSession ? (
            <ActivityIndicator size='small' color={colors.info} />
          ) : (
            <Text style={[styles.actionRowArrow, { color: colors.info }]}>
              ›
            </Text>
          )}
        </TouchableOpacity>
      )}
    </>
  );
}

interface LiftTogetherActionProps {
  readonly selectedFriend: Friend | null;
  readonly friendSessionStatuses: Record<string | number, boolean>;
  readonly isInJointSession: boolean;
  readonly getInviteStatusForFriend: (friendId: number | string) => string;
  readonly onLeaveJointSession: () => void;
  readonly onSendInvite: (friend: Friend) => void;
  readonly styles: ReturnType<typeof makeStyles>;
  readonly jointStyles: ReturnType<typeof makeJointStyles>;
  readonly colors: ThemeColors;
}

function LiftTogetherAction({
  selectedFriend,
  friendSessionStatuses,
  isInJointSession,
  getInviteStatusForFriend,
  onLeaveJointSession,
  onSendInvite,
  styles,
  jointStyles,
  colors,
}: LiftTogetherActionProps): React.JSX.Element {
  const friendActive =
    !!friendSessionStatuses[selectedFriend?.id as number | string];
  const cs = getInviteStatusForFriend(selectedFriend?.id as number | string);
  const jointActive = isInJointSession && cs === "active";
  const busy = cs === "sending" || cs === "waiting";

  return (
    <>
      <Text style={[styles.actionsTabSectionTitle, { marginTop: 28 }]}>
        Lift Together
      </Text>
      {jointActive && (
        <View style={[styles.actionRow, jointStyles.activeRow]}>
          <View style={jointStyles.liveDot} />
          <View style={styles.actionRowText}>
            <Text style={[styles.actionRowTitle, { color: colors.success }]}>
              Joint session active 🎉
            </Text>
            <Text style={styles.actionRowSub}>
              Your sets are synced – open the Workout tab.
            </Text>
          </View>
          <TouchableOpacity
            style={jointStyles.leaveBtn}
            onPress={onLeaveJointSession}
          >
            <Text style={jointStyles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        </View>
      )}
      {!jointActive && !friendActive && (
        <View style={[styles.actionRow, { opacity: 0.6 }]}>
          <Text style={styles.actionRowIcon}>🏋️</Text>
          <View style={styles.actionRowText}>
            <Text style={styles.actionRowTitle}>Lift Together</Text>
            <Text style={styles.actionRowSub}>
              {selectedFriend?.username} is not currently in a workout session.
            </Text>
          </View>
        </View>
      )}
      {!jointActive && friendActive && (
        <TouchableOpacity
          style={[
            styles.actionRow,
            jointStyles.inviteRow,
            cs === "waiting" && { opacity: 0.7 },
          ]}
          onPress={() => selectedFriend && onSendInvite(selectedFriend)}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Text style={styles.actionRowIcon}>🏋️</Text>
          <View style={styles.actionRowText}>
            <Text style={[styles.actionRowTitle, { color: colors.accentDark }]}>
              {cs === "waiting"
                ? "Waiting for response…"
                : "Invite to Lift Together"}
            </Text>
            <Text style={styles.actionRowSub}>
              {selectedFriend?.username} is working out. Sync up!
            </Text>
          </View>
          {busy ? (
            <ActivityIndicator size='small' color={colors.accentDark} />
          ) : (
            <Text style={[styles.actionRowArrow, { color: colors.accentDark }]}>
              ›
            </Text>
          )}
        </TouchableOpacity>
      )}
    </>
  );
}

interface FriendActionsTabProps {
  readonly selectedFriend: Friend | null;
  readonly styles: ReturnType<typeof makeStyles>;
  readonly watchStyles: ReturnType<typeof makeWatchStyles>;
  readonly jointStyles: ReturnType<typeof makeJointStyles>;
  readonly colors: ThemeColors;
  readonly workoutData: unknown;
  readonly getGrantedPermission: (
    friendId: number | string,
    type: string,
  ) => GrantedPermission | undefined;
  readonly isPermLoading: (
    friendId: number | string | undefined,
    type: string,
  ) => boolean;
  readonly hasReceivedPermission: (
    friendId: number | string | undefined,
    type: string,
  ) => boolean;
  readonly onGrantPermission: (friend: Friend, type: string) => void;
  readonly onRevokePermission: (friend: Friend, type: string) => void;
  readonly onGrantProgramPermission: (friend: Friend) => void;
  readonly friendSessionStatuses: Record<string | number, boolean>;
  readonly isWatching: boolean;
  readonly watchTarget: { friendId?: string } | null;
  readonly checkingActiveSession: boolean;
  readonly onWatchSession: (friend: Friend) => void;
  readonly onStopWatching: () => void;
  readonly hasOwnActiveSession: boolean;
  readonly isInJointSession: boolean;
  readonly getInviteStatusForFriend: (friendId: number | string) => string;
  readonly onLeaveJointSession: () => void;
  readonly onSendInvite: (friend: Friend) => void;
  readonly onRemoveFriend: (friend: Friend) => void;
}

export function FriendActionsTab({
  selectedFriend,
  styles,
  watchStyles,
  jointStyles,
  colors,
  workoutData,
  getGrantedPermission,
  isPermLoading,
  hasReceivedPermission,
  onGrantPermission,
  onRevokePermission,
  onGrantProgramPermission,
  friendSessionStatuses,
  isWatching,
  watchTarget,
  checkingActiveSession,
  onWatchSession,
  onStopWatching,
  hasOwnActiveSession,
  isInJointSession,
  getInviteStatusForFriend,
  onLeaveJointSession,
  onSendInvite,
  onRemoveFriend,
}: FriendActionsTabProps): React.JSX.Element {
  const showLiveSession = hasReceivedPermission(
    selectedFriend?.id,
    "watch_session",
  );
  const showLiftTogether =
    hasOwnActiveSession &&
    hasReceivedPermission(selectedFriend?.id, "joint_session");

  return (
    <ScrollView style={styles.modalScroll}>
      <View style={styles.actionsTabContent}>
        <FriendGrantedPermissions
          selectedFriend={selectedFriend}
          workoutData={workoutData}
          styles={styles}
          getGrantedPermission={getGrantedPermission}
          isPermLoading={isPermLoading}
          onGrantPermission={onGrantPermission}
          onGrantProgramPermission={onGrantProgramPermission}
          onRevokePermission={onRevokePermission}
        />

        <FriendReceivedPermissions
          selectedFriend={selectedFriend}
          styles={styles}
          hasReceivedPermission={hasReceivedPermission}
        />

        {showLiveSession && (
          <LiveSessionAction
            selectedFriend={selectedFriend}
            friendSessionStatuses={friendSessionStatuses}
            isWatching={isWatching}
            watchTarget={watchTarget}
            checkingActiveSession={checkingActiveSession}
            onWatch={onWatchSession}
            onStopWatching={onStopWatching}
            styles={styles}
            watchStyles={watchStyles}
            colors={colors}
          />
        )}

        {showLiftTogether && (
          <LiftTogetherAction
            selectedFriend={selectedFriend}
            friendSessionStatuses={friendSessionStatuses}
            isInJointSession={isInJointSession}
            getInviteStatusForFriend={getInviteStatusForFriend}
            onLeaveJointSession={onLeaveJointSession}
            onSendInvite={onSendInvite}
            styles={styles}
            jointStyles={jointStyles}
            colors={colors}
          />
        )}

        {/* ═══ Danger Zone ══════════════════════════════════════════ */}
        <Text style={[styles.actionsTabSectionTitle, { marginTop: 28 }]}>
          Danger Zone
        </Text>
        <TouchableOpacity
          style={[styles.actionRow, styles.actionRowDanger]}
          onPress={() => selectedFriend && onRemoveFriend(selectedFriend)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionRowIcon}>🚫</Text>
          <View style={styles.actionRowText}>
            <Text style={[styles.actionRowTitle, { color: colors.error }]}>
              Remove Friend
            </Text>
            <Text style={styles.actionRowSub}>
              Remove {selectedFriend?.username} from your friends list
            </Text>
          </View>
          <Text style={[styles.actionRowArrow, { color: colors.error }]}>
            ›
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
