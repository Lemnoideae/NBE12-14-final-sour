import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient, useAuthSession } from '../api/ApiProvider';
import { submitClicks } from '../api/clicks';
import { isClickLimitError, requiresClickVerification } from '../api/abuse';
import { errorMessage } from '../api/errors';
import { selectByMode } from '../api/mode';
import { userKeys, useMyInfo, type MyInfo } from '../api/users';
import { createClickBatcher, type ClickBatchSnapshot } from '../utils/clickBatcher';
import { useMockGame } from './useMockGame';

interface CampusClicks {
  tap: (isCrit: boolean) => number | null;
  notice: string | null;
  getPendingScore: () => number;
  retryLimited: (() => void) | null;
  botCheck: { open: boolean; onOpen: () => void; onClose: () => void; onVerified: () => void } | null;
}
const noPendingScore = () => 0;
const EMPTY_BATCH: ClickBatchSnapshot = { pendingClicks: 0, pendingScore: 0, sending: false, error: null, recoverable: false };

function useMockCampusClicks(): CampusClicks {
  const { tap } = useMockGame();
  return { tap, notice: null, getPendingScore: noPendingScore, retryLimited: null, botCheck: null };
}

/** Mounted at the app root, not on the campus screen: changing tabs must not cancel a collected batch. */
export function useApiCampusClicks(): CampusClicks {
  const client = useApiClient();
  const signedIn = useAuthSession().status === 'signed-in';
  const { data: me } = useMyInfo();
  const queryClient = useQueryClient();
  const { applyApiTap, applyApiScores, player } = useMockGame();
  const batcher = useRef<ReturnType<typeof createClickBatcher> | null>(null);
  const [snapshot, setSnapshot] = useState(EMPTY_BATCH);
  const [cancelledClicks, setCancelledClicks] = useState(0);
  const [queueGeneration, setQueueGeneration] = useState(0);
  const [botCheckOpen, setBotCheckOpen] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const userId = signedIn ? me?.id : undefined;

  useEffect(() => {
    if (userId === undefined) return;
    const controller = createClickBatcher({
      send: (body) => submitClicks(client, body),
      onChange: setSnapshot,
      onAccepted(response, pendingScore) {
        setRecoveryNotice(null);
        applyApiScores({
          contribution: response.myContribScore + pendingScore,
          schoolScore: response.university.totalScore + pendingScore,
          departmentScore: response.department.totalScore + pendingScore,
        });
        // Keep the profile fresh too. ApiPlayerSync adds the still-unconfirmed optimistic offset when applying it.
        queryClient.setQueryData<MyInfo>(userKeys.me, (current) => current?.id === userId
          ? { ...current, totalContribScore: response.myContribScore }
          : current);
      },
    });
    batcher.current = controller;
    setSnapshot(EMPTY_BATCH);
    setBotCheckOpen(false);
    setRecoveryNotice(null);
    // Session loss invalidates the queue synchronously, before React can render a new signed-in member.
    const unsubscribe = client.session.subscribe(() => {
      if (client.session.getState().status === 'signed-in') return;
      controller.dispose();
      if (batcher.current === controller) batcher.current = null;
      setCancelledClicks(controller.getSnapshot().pendingClicks);
      setBotCheckOpen(false);
      setQueueGeneration((generation) => generation + 1);
      setSnapshot(EMPTY_BATCH);
    });
    return () => {
      unsubscribe();
      controller.dispose();
      if (batcher.current === controller) batcher.current = null;
    };
  }, [client, queryClient, userId, applyApiScores, queueGeneration]);

  useEffect(() => {
    if (signedIn && requiresClickVerification(snapshot.error)) setBotCheckOpen(true);
  }, [signedIn, snapshot.error]);

  const hasPendingClicks = snapshot.pendingClicks > 0;
  useEffect(() => {
    if (!hasPendingClicks) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasPendingClicks]);

  const getPendingScore = useCallback(() => batcher.current?.getSnapshot().pendingScore ?? 0, []);
  const ready = signedIn && me !== undefined && player.userId === String(me.id);
  const tap = useCallback((_isCrit: boolean): number | null => {
    if (!ready || !me || !batcher.current) return null;
    if (requiresClickVerification(batcher.current.getSnapshot().error)) {
      setBotCheckOpen(true);
      return null;
    }
    // The click endpoint has no critical-hit field; its score uses the signed-in member's actual click power.
    const points = me.clicker.clickPower;
    if (!batcher.current.enqueue(points)) return null;
    setCancelledClicks(0);
    applyApiTap(points);
    return points;
  }, [ready, me, applyApiTap]);

  const retryLimited = useCallback(() => {
    const rejected = batcher.current?.discardRateLimitedBatch();
    if (!rejected) return;
    applyApiTap(-rejected.score);
    setRecoveryNotice(`서버가 거절한 ${rejected.clicks}회는 적립되지 않았습니다. 남은 대기 클릭은 유지하며 다시 클릭할 수 있습니다.`);
  }, [applyApiTap]);
  const openBotCheck = useCallback(() => setBotCheckOpen(true), []);
  const closeBotCheck = useCallback(() => setBotCheckOpen(false), []);
  const completeBotCheck = useCallback(() => {
    const resumed = batcher.current?.resumeAfterVerification();
    setBotCheckOpen(false);
    if (!resumed) setRecoveryNotice('봇 확인은 완료했지만 이전 제출의 처리 여부가 불명확해 재전송하지 않았습니다. 새로고침해 서버 점수를 확인해 주세요.');
  }, []);
  const canRetryLimited = signedIn && snapshot.recoverable && isClickLimitError(snapshot.error);
  const needsVerification = signedIn && requiresClickVerification(snapshot.error);
  const notice = snapshot.error
    ? `${recoveryNotice ? `${recoveryNotice} ` : ''}${errorMessage(snapshot.error)} 미확정 ${snapshot.pendingClicks}회 전송을 보류했습니다. ${canRetryLimited ? '잠시 기다린 뒤 아래 버튼을 누르면 거절된 배치의 점수를 되돌리고 남은 대기 클릭을 재개합니다.' : needsVerification && snapshot.recoverable ? '자동 입력 방지 확인을 마치면 같은 배치로 다시 전송합니다.' : '중복 적립 방지를 위해 추가 클릭과 재전송을 중단했습니다.'} 새로고침하면 미확정 클릭은 사라지며 서버에 반영된 점수만 남습니다.`
    : cancelledClicks > 0
      ? `세션 종료로 미확정 ${cancelledClicks}회 전송을 중단했습니다. 이미 전송한 요청은 반영되었을 수 있으므로 다시 로그인해 점수를 확인해 주세요.`
      : !signedIn
        ? '클릭 점수를 적립하려면 로그인해 주세요.'
        : !ready ? '내 정보를 불러온 뒤 클릭할 수 있습니다.' : recoveryNotice;
  return {
    tap, notice, getPendingScore,
    retryLimited: canRetryLimited ? retryLimited : null,
    botCheck: needsVerification ? { open: botCheckOpen, onOpen: openBotCheck, onClose: closeBotCheck, onVerified: completeBotCheck } : null,
  };
}

export const useCampusClicks = selectByMode({ api: useApiCampusClicks, mock: useMockCampusClicks });
