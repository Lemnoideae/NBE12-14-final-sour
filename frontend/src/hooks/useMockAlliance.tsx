import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  applyAllianceRequest,
  cancelAllianceRequest,
  demoAcceptAllianceRequest,
  demoRejectAllianceRequest,
  INITIAL_ALLIANCE_STATE,
  type Alliance,
  type AllianceActionResult,
  type AllianceRequest,
  type AllianceState,
} from '../data/allianceModel.ts';
import { useMockGame } from './useMockGame.tsx';

interface AllianceContextValue {
  state: AllianceState;
  mySchoolId: string;
  currentAlliance: Alliance | null;
  sentRequests: readonly AllianceRequest[];
  receivedRequests: readonly AllianceRequest[];
  pendingRequests: readonly AllianceRequest[];
  simulateRequestFailure: boolean;
  simulateLoadFailure: boolean;
  applyRequest: (targetSchoolId: string) => AllianceActionResult;
  cancelRequest: (requestId: string) => AllianceActionResult;
  demoAcceptRequest: (requestId: string) => AllianceActionResult;
  demoRejectRequest: (requestId: string) => AllianceActionResult;
  toggleSimulateRequestFailure: () => void;
  toggleSimulateLoadFailure: () => void;
  retryLoad: () => void;
}

const AllianceContext = createContext<AllianceContextValue | null>(null);

export function AllianceProvider({
  children,
  initialState = INITIAL_ALLIANCE_STATE,
}: {
  children: React.ReactNode;
  initialState?: AllianceState;
}) {
  const { player } = useMockGame();
  const mySchoolId = player.schoolId;

  const [state, setState] = useState<AllianceState>(initialState);
  const stateRef = useRef<AllianceState>(initialState);
  stateRef.current = state;

  const currentAlliance = useMemo(() => {
    return state.alliances.find((a) => a.schoolIds.includes(mySchoolId)) ?? null;
  }, [state.alliances, mySchoolId]);

  const sentRequests = useMemo(() => {
    return state.requests.filter((r) => r.requesterSchoolId === mySchoolId);
  }, [state.requests, mySchoolId]);

  const receivedRequests = useMemo(() => {
    return state.requests.filter((r) => r.recipientSchoolId === mySchoolId);
  }, [state.requests, mySchoolId]);

  const pendingRequests = useMemo(() => {
    return state.requests.filter(
      (r) => r.status === 'pending' && (r.requesterSchoolId === mySchoolId || r.recipientSchoolId === mySchoolId),
    );
  }, [state.requests, mySchoolId]);

  // Synchronous commit via stateRef:
  // Same-tick calls (double click, immediate sequential calls before re-render)
  // always validate against the latest synchronously committed state.
  const commit = useCallback(
    (actionFn: (current: AllianceState) => { nextState: AllianceState; result: AllianceActionResult }): AllianceActionResult => {
      const current = stateRef.current;
      const { nextState, result } = actionFn(current);
      if (result.success && nextState !== current) {
        stateRef.current = nextState;
        setState(nextState);
      }
      return result;
    },
    [],
  );

  const applyRequest = useCallback(
    (targetSchoolId: string): AllianceActionResult => {
      return commit((current) => applyAllianceRequest(current, mySchoolId, targetSchoolId));
    },
    [commit, mySchoolId],
  );

  const cancelRequest = useCallback(
    (requestId: string): AllianceActionResult => {
      return commit((current) => cancelAllianceRequest(current, requestId));
    },
    [commit],
  );

  const demoAcceptRequest = useCallback(
    (requestId: string): AllianceActionResult => {
      return commit((current) => demoAcceptAllianceRequest(current, requestId));
    },
    [commit],
  );

  const demoRejectRequest = useCallback(
    (requestId: string): AllianceActionResult => {
      return commit((current) => demoRejectAllianceRequest(current, requestId));
    },
    [commit],
  );

  const toggleSimulateRequestFailure = useCallback(() => {
    const nextState = { ...stateRef.current, simulateRequestFailure: !stateRef.current.simulateRequestFailure };
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const toggleSimulateLoadFailure = useCallback(() => {
    const nextState = { ...stateRef.current, simulateLoadFailure: !stateRef.current.simulateLoadFailure };
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const retryLoad = useCallback(() => {
    const nextState = { ...stateRef.current, simulateLoadFailure: false };
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const value: AllianceContextValue = {
    state,
    mySchoolId,
    currentAlliance,
    sentRequests,
    receivedRequests,
    pendingRequests,
    simulateRequestFailure: state.simulateRequestFailure,
    simulateLoadFailure: state.simulateLoadFailure,
    applyRequest,
    cancelRequest,
    demoAcceptRequest,
    demoRejectRequest,
    toggleSimulateRequestFailure,
    toggleSimulateLoadFailure,
    retryLoad,
  };

  return <AllianceContext.Provider value={value}>{children}</AllianceContext.Provider>;
}

export function useAlliance() {
  const ctx = useContext(AllianceContext);
  if (!ctx) {
    throw new Error('AllianceProvider is required to use useAlliance');
  }
  return ctx;
}

export const useMockAlliance = useAlliance;
