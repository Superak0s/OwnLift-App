import React, { useState } from "react";
import { create, act } from "react-test-renderer";
import { useSyncManager } from "../useSyncManager";
import { workoutApi } from "@features/workout/services/index";
import type { PendingSync } from "../../../types";

jest.mock("@features/workout/services/index", () => ({
  workoutApi: {
    startSession: jest.fn(),
    recordSet: jest.fn(),
    endSession: jest.fn(),
  },
}));

const startSession = workoutApi.startSession as jest.Mock;

function makeSync(timestamp: string): PendingSync {
  return {
    type: "startSession",
    data: { person: "local", dayNumber: 1, isDemo: false },
    timestamp,
  };
}

type Control = {
  syncPendingData: () => Promise<void>;
  getPendingSyncs: () => PendingSync[];
};

function Harness({
  initialSyncs,
  controlRef,
}: {
  initialSyncs: PendingSync[];
  controlRef: React.MutableRefObject<Control | null>;
}) {
  const [pendingSyncs, setPendingSyncs] = useState(initialSyncs);
  const [isSyncing, setIsSyncing] = useState(false);
  const sync = useSyncManager({
    pendingSyncs,
    setPendingSyncs,
    isSyncing,
    setIsSyncing,
    currentSessionId: null,
    setCurrentSessionId: () => {},
    userId: "u1",
    saveToStorage: jest.fn().mockResolvedValue(true),
    STORAGE_KEYS: { PENDING_SYNCS: "pending", CURRENT_SESSION_ID: "session" },
    useManualTime: true,
  });
  controlRef.current = {
    syncPendingData: sync.syncPendingData,
    getPendingSyncs: () => pendingSyncs,
  };
  return null;
}

describe("useSyncManager retry/backoff", () => {
  beforeEach(() => {
    startSession.mockReset();
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps a failing sync queued and skips it during its backoff window", async () => {
    startSession.mockRejectedValue(new Error("network down"));
    const controlRef: React.MutableRefObject<Control | null> = { current: null };
    act(() => {
      create(<Harness initialSyncs={[makeSync("t1")]} controlRef={controlRef} />);
    });

    await act(async () => {
      await controlRef.current!.syncPendingData();
    });
    expect(controlRef.current!.getPendingSyncs()).toHaveLength(1);
    expect(startSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await controlRef.current!.syncPendingData();
    });
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it("drops a sync after MAX_SYNC_RETRIES consecutive failures", async () => {
    startSession.mockRejectedValue(new Error("network down"));
    const controlRef: React.MutableRefObject<Control | null> = { current: null };
    act(() => {
      create(<Harness initialSyncs={[makeSync("t1")]} controlRef={controlRef} />);
    });

    for (let i = 0; i < 9; i++) {
      jest.setSystemTime(Date.now() + 40 * 60_000);
      await act(async () => {
        await controlRef.current!.syncPendingData();
      });
    }

    expect(controlRef.current!.getPendingSyncs()).toHaveLength(0);
    expect(startSession).toHaveBeenCalledTimes(9);
  });
});
