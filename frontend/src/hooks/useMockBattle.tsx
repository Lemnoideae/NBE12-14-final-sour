// 대결 상태 관리 컨텍스트 및 훅 (N4 대결 신청 및 현황)
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  applyBattleRequest,
  cancelBattleRequest,
  createInitialBattleState,
  demoAcceptBattleRequest,
  demoCancelConfirmedBattle,
  demoRejectBattleRequest,
  getEffectiveBattleStatus,
  getOccupiedBattleForAlliance,
  isAllianceOccupied,
  type Battle,
  type BattleActionResult,
  type BattleConfig,
  type BattleState,
} from '../data/battleModel.ts';
import { MOCK_SHOP_CONFIG } from '../data/mockShopConfig.ts';
import { useAlliance } from './useMockAlliance.tsx';

interface BattleContextValue {
  state: BattleState;
  config: BattleConfig;
  effectiveNow: number;
  myAllianceId: string | null;
  myAllianceBattles: readonly Battle[];
  pendingBattles: readonly Battle[];
  activeBattles: readonly Battle[];
  finishedBattles: readonly Battle[];
  isMyAllianceOccupied: boolean;
  myOccupiedBattle: Battle | undefined;
  applyRequest: (targetAllianceId: string, format: number, durationHours: number, requestedStartTime: number) => BattleActionResult;
  cancelRequest: (battleId: string) => BattleActionResult;
  demoAcceptRequest: (battleId: string) => BattleActionResult;
  demoRejectRequest: (battleId: string) => BattleActionResult;
  demoCancelConfirmedRequest: (battleId: string) => BattleActionResult;
  fastForwardClock: (hours: number) => void;
  resetClock: () => void;
  toggleSimulateRequestFailure: () => void;
  toggleSimulateLoadFailure: () => void;
  retryLoad: () => void;
}

const BattleContext = createContext<BattleContextValue | null>(null);

export function BattleProvider({
  children,
  initialState,
  config = MOCK_SHOP_CONFIG.battle,
}: {
  children?: React.ReactNode;
  initialState?: BattleState;
  config?: BattleConfig;
}) {
  const { currentAlliance, state: allianceState } = useAlliance();
  const myAllianceId = currentAlliance?.id ?? null;

  const [state, setState] = useState<BattleState>(() => {
    if (initialState) {
      return {
        ...initialState,
        config: config ?? initialState.config ?? MOCK_SHOP_CONFIG.battle,
      };
    }
    return createInitialBattleState(Date.now(), config);
  });
  const stateRef = useRef<BattleState>(state);
  stateRef.current = state;

  const effectiveNow = Date.now() + state.demoClockOffsetMs;

  // 동기식 원자적 커밋 함수 (P2와 동일한 stateRef 패턴으로 동일 틱 레이스 차단)
  const commit = useCallback(
    (actionFn: (current: BattleState) => { nextState: BattleState; result: BattleActionResult }): BattleActionResult => {
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
    (targetAllianceId: string, format: number, durationHours: number, requestedStartTime: number): BattleActionResult => {
      if (!myAllianceId) {
        return { success: false, error: '소속된 연합이 없습니다. 먼저 연합을 결성해 주세요.' };
      }
      const now = Date.now() + stateRef.current.demoClockOffsetMs;
      return commit((current) =>
        applyBattleRequest(
          current,
          allianceState.alliances,
          myAllianceId,
          targetAllianceId,
          format,
          durationHours,
          requestedStartTime,
          now,
          current.config,
        ),
      );
    },
    [commit, myAllianceId, allianceState.alliances],
  );

  const cancelRequest = useCallback(
    (battleId: string): BattleActionResult => {
      const now = Date.now() + stateRef.current.demoClockOffsetMs;
      return commit((current) => cancelBattleRequest(current, battleId, now));
    },
    [commit],
  );

  const demoAcceptRequest = useCallback(
    (battleId: string): BattleActionResult => {
      const now = Date.now() + stateRef.current.demoClockOffsetMs;
      return commit((current) =>
        demoAcceptBattleRequest(current, allianceState.alliances, battleId, now, current.config),
      );
    },
    [commit, allianceState.alliances],
  );

  const demoRejectRequest = useCallback(
    (battleId: string): BattleActionResult => {
      const now = Date.now() + stateRef.current.demoClockOffsetMs;
      return commit((current) => demoRejectBattleRequest(current, battleId, now));
    },
    [commit],
  );

  const demoCancelConfirmedRequest = useCallback(
    (battleId: string): BattleActionResult => {
      const now = Date.now() + stateRef.current.demoClockOffsetMs;
      return commit((current) => demoCancelConfirmedBattle(current, battleId, now));
    },
    [commit],
  );

  const fastForwardClock = useCallback((hours: number) => {
    const nextOffset = stateRef.current.demoClockOffsetMs + hours * 3600_000;
    const nextState = { ...stateRef.current, demoClockOffsetMs: nextOffset };
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const resetClock = useCallback(() => {
    const nextState = { ...stateRef.current, demoClockOffsetMs: 0 };
    stateRef.current = nextState;
    setState(nextState);
  }, []);

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

  const myAllianceBattles = useMemo(() => {
    if (!myAllianceId) return [];
    return state.battles.filter(
      (b) => b.requesterAllianceId === myAllianceId || b.recipientAllianceId === myAllianceId,
    );
  }, [state.battles, myAllianceId]);

  const pendingBattles = useMemo(() => {
    return state.battles.filter((b) => getEffectiveBattleStatus(b, effectiveNow) === 'pending');
  }, [state.battles, effectiveNow]);

  const activeBattles = useMemo(() => {
    return state.battles.filter((b) => {
      const s = getEffectiveBattleStatus(b, effectiveNow);
      return s === 'active' || s === 'scheduled';
    });
  }, [state.battles, effectiveNow]);

  const finishedBattles = useMemo(() => {
    return state.battles.filter((b) => getEffectiveBattleStatus(b, effectiveNow) === 'finished');
  }, [state.battles, effectiveNow]);

  const isMyAllianceOccupied = useMemo(() => {
    if (!myAllianceId) return false;
    return isAllianceOccupied(state.battles, myAllianceId, effectiveNow);
  }, [state.battles, myAllianceId, effectiveNow]);

  const myOccupiedBattle = useMemo(() => {
    if (!myAllianceId) return undefined;
    return getOccupiedBattleForAlliance(state.battles, myAllianceId, effectiveNow);
  }, [state.battles, myAllianceId, effectiveNow]);

  const value = useMemo<BattleContextValue>(() => {
    return {
      state,
      config: state.config,
      effectiveNow,
      myAllianceId,
      myAllianceBattles,
      pendingBattles,
      activeBattles,
      finishedBattles,
      isMyAllianceOccupied,
      myOccupiedBattle,
      applyRequest,
      cancelRequest,
      demoAcceptRequest,
      demoRejectRequest,
      demoCancelConfirmedRequest,
      fastForwardClock,
      resetClock,
      toggleSimulateRequestFailure,
      toggleSimulateLoadFailure,
      retryLoad,
    };
  }, [
    state,
    effectiveNow,
    myAllianceId,
    myAllianceBattles,
    pendingBattles,
    activeBattles,
    finishedBattles,
    isMyAllianceOccupied,
    myOccupiedBattle,
    applyRequest,
    cancelRequest,
    demoAcceptRequest,
    demoRejectRequest,
    demoCancelConfirmedRequest,
    fastForwardClock,
    resetClock,
    toggleSimulateRequestFailure,
    toggleSimulateLoadFailure,
    retryLoad,
  ]);

  return <BattleContext.Provider value={value}>{children}</BattleContext.Provider>;
}

export function useBattle(): BattleContextValue {
  const ctx = useContext(BattleContext);
  if (!ctx) {
    throw new Error('useBattle must be used within BattleProvider');
  }
  return ctx;
}
