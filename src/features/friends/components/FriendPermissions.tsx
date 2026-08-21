import React from "react";
import { Text } from "react-native";
import { PermissionRow } from "./PermissionRow";
import type { Friend, GrantedPermission } from "../services";
import type { makeStyles } from "../FriendsScreen";

const RECEIVED_PERMISSION_TYPES: Array<{
  type: string;
  icon: string;
  label: string;
}> = [
  { type: "history", icon: "📅", label: "History Access" },
  { type: "analytics", icon: "📊", label: "Analytics Access" },
  { type: "program", icon: "📋", label: "Shared Program" },
  { type: "joint_session", icon: "🏋️", label: "Joint Session" },
  { type: "watch_session", icon: "👀", label: "Watch Session" },
];

function getShareProgramDescription(
  workoutData: unknown,
  username: string | undefined,
): string {
  if (!workoutData)
    return "No program loaded. Load a workout program first to share it.";
  const wd = workoutData as unknown as {
    split?: string[];
    people?: string[];
    totalDays?: number;
  };
  const split = wd.split ?? wd.people;
  return `Share your current program (${split?.join("/")} — ${wd.totalDays} days) with ${username}.`;
}

interface FriendGrantedPermissionsProps {
  readonly selectedFriend: Friend | null;
  readonly workoutData: unknown;
  readonly styles: ReturnType<typeof makeStyles>;
  readonly getGrantedPermission: (
    friendId: number | string,
    type: string,
  ) => GrantedPermission | undefined;
  readonly isPermLoading: (
    friendId: number | string | undefined,
    type: string,
  ) => boolean;
  readonly onGrantPermission: (friend: Friend, type: string) => void;
  readonly onGrantProgramPermission: (friend: Friend) => void;
  readonly onRevokePermission: (friend: Friend, type: string) => void;
}

export function FriendGrantedPermissions({
  selectedFriend,
  workoutData,
  styles,
  getGrantedPermission,
  isPermLoading,
  onGrantPermission,
  onGrantProgramPermission,
  onRevokePermission,
}: FriendGrantedPermissionsProps): React.JSX.Element {
  const friendId = selectedFriend?.id as number | string;
  return (
    <>
      <Text style={styles.actionsTabSectionTitle}>
        Permissions for {selectedFriend?.username}
      </Text>
      <Text style={styles.actionsTabSectionHint}>
        Control what {selectedFriend?.username} is allowed to see and do.
      </Text>

      <PermissionRow
        icon='📅'
        title='History Access'
        description={`Let ${selectedFriend?.username} view your workout history calendar and session details.`}
        granted={!!getGrantedPermission(friendId, "history")}
        loading={isPermLoading(selectedFriend?.id, "history")}
        onGrant={() =>
          selectedFriend && onGrantPermission(selectedFriend, "history")
        }
        onRevoke={() =>
          selectedFriend && onRevokePermission(selectedFriend, "history")
        }
      />

      <PermissionRow
        icon='📊'
        title='Analytics Access'
        description={`Let ${selectedFriend?.username} view your workout analytics and progress charts.`}
        granted={!!getGrantedPermission(friendId, "analytics")}
        loading={isPermLoading(selectedFriend?.id, "analytics")}
        onGrant={() =>
          selectedFriend && onGrantPermission(selectedFriend, "analytics")
        }
        onRevoke={() =>
          selectedFriend && onRevokePermission(selectedFriend, "analytics")
        }
      />

      <PermissionRow
        icon='📋'
        title='Share My Program'
        description={getShareProgramDescription(
          workoutData,
          selectedFriend?.username,
        )}
        granted={!!getGrantedPermission(friendId, "program")}
        loading={isPermLoading(selectedFriend?.id, "program")}
        onGrant={() =>
          selectedFriend && onGrantProgramPermission(selectedFriend)
        }
        onRevoke={() =>
          selectedFriend && onRevokePermission(selectedFriend, "program")
        }
      />

      <PermissionRow
        icon='🏋️'
        title='Joint Session'
        description={`Let ${selectedFriend?.username} invite you to lift together when you're both working out.`}
        granted={!!getGrantedPermission(friendId, "joint_session")}
        loading={isPermLoading(selectedFriend?.id, "joint_session")}
        onGrant={() =>
          selectedFriend && onGrantPermission(selectedFriend, "joint_session")
        }
        onRevoke={() =>
          selectedFriend && onRevokePermission(selectedFriend, "joint_session")
        }
      />

      <PermissionRow
        icon='👀'
        title='Watch Session'
        description={`Let ${selectedFriend?.username} watch your active workout session live.`}
        granted={!!getGrantedPermission(friendId, "watch_session")}
        loading={isPermLoading(selectedFriend?.id, "watch_session")}
        onGrant={() =>
          selectedFriend && onGrantPermission(selectedFriend, "watch_session")
        }
        onRevoke={() =>
          selectedFriend && onRevokePermission(selectedFriend, "watch_session")
        }
      />
    </>
  );
}

interface FriendReceivedPermissionsProps {
  readonly selectedFriend: Friend | null;
  readonly styles: ReturnType<typeof makeStyles>;
  readonly hasReceivedPermission: (
    friendId: number | string | undefined,
    type: string,
  ) => boolean;
}

export function FriendReceivedPermissions({
  selectedFriend,
  styles,
  hasReceivedPermission,
}: FriendReceivedPermissionsProps): React.JSX.Element {
  return (
    <>
      <Text style={[styles.actionsTabSectionTitle, { marginTop: 28 }]}>
        {selectedFriend?.username}'s Permissions for You
      </Text>
      <Text style={styles.actionsTabSectionHint}>
        What {selectedFriend?.username} has allowed you to do.
      </Text>

      {RECEIVED_PERMISSION_TYPES.map(({ type, icon, label }) => {
        const has = hasReceivedPermission(selectedFriend?.id, type);
        return (
          <PermissionRow
            key={type}
            icon={icon}
            title={label}
            description={
              has
                ? `${selectedFriend?.username} has granted you this.`
                : `${selectedFriend?.username} hasn't granted this yet.`
            }
            granted={has}
            readOnly
          />
        );
      })}
    </>
  );
}
