import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useJointSession } from "./hooks/useJointSession";
import type { RealtimeSocket, WebSocketMessage } from "./hooks/useRealtimeSocket";
import type {
  JointSession,
  PartnerProgress,
  PartnerCompletedSet,
  WatchTarget,
  JointExerciseEntry,
} from "./hooks/useJointSession";

// Joint-session/live-watch state changes on every WebSocket message (partner
// progress, sync pulses, watch updates). It's split out of WorkoutContext so
// screens that don't touch joint sessions (Home, Plan, Analytics, Settings)
// don't re-render on every message.

interface JointSessionContextValue {
  socketLastMessage: WebSocketMessage | null;
  jointSession: JointSession | null;
  isInJointSession: boolean;
  partnerProgress: PartnerProgress | null;
  partnerExerciseList: Array<{ name: string; sets: number }>;
  myJointProgress: Record<string, unknown> | null;
  pendingJointInvite: WebSocketMessage | null;
  jointInviteStatus: string;
  isPartnerReady: boolean;
  syncPulse: boolean;
  sendJointInvite: (toUserId: string) => Promise<boolean>;
  acceptJointInvite: () => Promise<boolean>;
  declineJointInvite: () => Promise<void>;
  leaveJointSession: () => Promise<void>;
  pushJointProgress: (args: {
    exerciseIndex: number | null;
    setIndex: number | null;
    exerciseName: string | null;
    readyForNext?: boolean;
  }) => Promise<void>;
  partnerCompletedSets: PartnerCompletedSet[];
  isWatching: boolean;
  watchTarget: WatchTarget | null;
  watchSession: unknown;
  watchLoading: boolean;
  watchError: string | null;
  startWatching: (
    friendId: string,
    friendUsername: string,
    sessionId: string,
  ) => Promise<boolean>;
  stopWatching: () => void;
}

const JointSessionContext = createContext<JointSessionContextValue | undefined>(
  undefined,
);

export const useJointSessionContext = (): JointSessionContextValue => {
  const context = useContext(JointSessionContext);
  if (!context)
    throw new Error(
      "useJointSessionContext must be used within a JointSessionProvider",
    );
  return context;
};

interface JointSessionProviderProps {
  children: ReactNode;
  socket: RealtimeSocket;
  messageHandlerRef: MutableRefObject<((msg: WebSocketMessage) => void) | null>;
  userId: string | null;
  currentSessionId: string | null;
  workoutStartTime: string | null;
  currentDayExercises: JointExerciseEntry[];
  selectedSplit: string | null;
}

export const JointSessionProvider = ({
  children,
  socket,
  messageHandlerRef,
  userId,
  currentSessionId,
  workoutStartTime,
  currentDayExercises,
  selectedSplit,
}: JointSessionProviderProps) => {
  const jointSessionHook = useJointSession({
    userId,
    currentSessionId,
    workoutStartTime,
    currentDayExercises,
    selectedSplit,
    socket,
  });

  useEffect(() => {
    messageHandlerRef.current = jointSessionHook.handleSocketMessage;
  }, [messageHandlerRef, jointSessionHook.handleSocketMessage]);

  const value = useMemo<JointSessionContextValue>(
    () => ({
      socketLastMessage: socket.lastMessage,
      jointSession: jointSessionHook.jointSession,
      isInJointSession: jointSessionHook.isInJointSession,
      partnerProgress: jointSessionHook.partnerProgress,
      partnerExerciseList: jointSessionHook.partnerExerciseList,
      myJointProgress: jointSessionHook.myProgress,
      pendingJointInvite: jointSessionHook.pendingInvite,
      jointInviteStatus: jointSessionHook.inviteStatus,
      isPartnerReady: jointSessionHook.isPartnerReady,
      syncPulse: jointSessionHook.syncPulse,
      sendJointInvite: jointSessionHook.sendInvite,
      acceptJointInvite: jointSessionHook.acceptInvite,
      declineJointInvite: jointSessionHook.declineInvite,
      leaveJointSession: jointSessionHook.leaveJointSession,
      pushJointProgress: jointSessionHook.pushProgress,
      partnerCompletedSets: jointSessionHook.partnerCompletedSets,
      isWatching: jointSessionHook.isWatching,
      watchTarget: jointSessionHook.watchTarget,
      watchSession: jointSessionHook.watchSession,
      watchLoading: jointSessionHook.watchLoading,
      watchError: jointSessionHook.watchError,
      startWatching: jointSessionHook.startWatching,
      stopWatching: jointSessionHook.stopWatching,
    }),
    [
      socket.lastMessage,
      jointSessionHook.jointSession,
      jointSessionHook.isInJointSession,
      jointSessionHook.partnerProgress,
      jointSessionHook.partnerExerciseList,
      jointSessionHook.myProgress,
      jointSessionHook.pendingInvite,
      jointSessionHook.inviteStatus,
      jointSessionHook.isPartnerReady,
      jointSessionHook.syncPulse,
      jointSessionHook.sendInvite,
      jointSessionHook.acceptInvite,
      jointSessionHook.declineInvite,
      jointSessionHook.leaveJointSession,
      jointSessionHook.pushProgress,
      jointSessionHook.partnerCompletedSets,
      jointSessionHook.isWatching,
      jointSessionHook.watchTarget,
      jointSessionHook.watchSession,
      jointSessionHook.watchLoading,
      jointSessionHook.watchError,
      jointSessionHook.startWatching,
      jointSessionHook.stopWatching,
    ],
  );

  return (
    <JointSessionContext.Provider value={value}>
      {children}
    </JointSessionContext.Provider>
  );
};
