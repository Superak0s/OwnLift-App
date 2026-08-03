import React, { createContext, useContext, useState, ReactNode } from "react";

interface TrackingModalsState {
  sorenessModalOpen: boolean;
  hydrationModalOpen: boolean;
  cycleModalOpen: boolean;
  refreshTrigger: number;
}

interface TrackingModalsContextType {
  state: TrackingModalsState;
  openSorenessModal: () => void;
  closeSorenessModal: () => void;
  openHydrationModal: () => void;
  closeHydrationModal: () => void;
  openCycleModal: () => void;
  closeCycleModal: () => void;
  triggerRefresh: () => void;
}

const TrackingModalsContext = createContext<
  TrackingModalsContextType | undefined
>(undefined);

export function TrackingModalsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrackingModalsState>({
    sorenessModalOpen: false,
    hydrationModalOpen: false,
    cycleModalOpen: false,
    refreshTrigger: 0,
  });

  const openSorenessModal = () =>
    setState((prev) => ({ ...prev, sorenessModalOpen: true }));

  const closeSorenessModal = () =>
    setState((prev) => ({ ...prev, sorenessModalOpen: false }));

  const openHydrationModal = () =>
    setState((prev) => ({ ...prev, hydrationModalOpen: true }));

  const closeHydrationModal = () =>
    setState((prev) => ({ ...prev, hydrationModalOpen: false }));

  const openCycleModal = () =>
    setState((prev) => ({ ...prev, cycleModalOpen: true }));

  const closeCycleModal = () =>
    setState((prev) => ({ ...prev, cycleModalOpen: false }));

  const triggerRefresh = () =>
    setState((prev) => ({ ...prev, refreshTrigger: prev.refreshTrigger + 1 }));

  const value: TrackingModalsContextType = {
    state,
    openSorenessModal,
    closeSorenessModal,
    openHydrationModal,
    closeHydrationModal,
    openCycleModal,
    closeCycleModal,
    triggerRefresh,
  };

  return (
    <TrackingModalsContext.Provider value={value}>
      {children}
    </TrackingModalsContext.Provider>
  );
}

export function useTrackingModals() {
  const context = useContext(TrackingModalsContext);
  if (context === undefined) {
    throw new Error(
      "useTrackingModals must be used within TrackingModalsProvider",
    );
  }
  return context;
}
