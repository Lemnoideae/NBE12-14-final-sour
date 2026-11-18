import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient, useAuthSession } from '../api/ApiProvider';
import { submitClicks } from '../api/clicks';
import { errorMessage } from '../api/errors';
import { selectByMode } from '../api/mode';
import { userKeys, useMyInfo, type MyInfo } from '../api/users';
import { createClickBatcher, type ClickBatchSnapshot } from '../utils/clickBatcher';
import { useMockGame } from './useMockGame';

interface CampusClicks {
  tap: (isCrit: boolean) => number | null;
  notice: string | null;
  getPendingScore: () => number;
}
const noPendingScore = () => 0;
const EMPTY_BATCH: ClickBatchSnapshot = { pendingClicks: 0, pendingScore: 0, sending: false, error: null };

function useMockCampusClicks(): CampusClicks {
  const { tap } = useMockGame();
  return { tap, notice: null, getPendingScore: noPendingScore };
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
  const userId = signedIn ? me?.id : undefined;

  useEffect(() => {
    if (userId === undefined) return;
    const controller = createClickBatcher({
      send: (body) => submitClicks(client, body),
      onChange: setSnapshot,
      onAccepted(response, pendingScore) {
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
    // Session loss invalidates the queue synchronously, before React can render a new signed-in member.
    const unsubscribe = client.session.subscribe(() => {
      if (client.session.getState().status === 'signed-in') return;
      controller.dispose();
      if (batcher.current === controller) batcher.current = null;
      setCancelledClicks(controller.getSnapshot().pendingClicks);
      setQueueGeneration((generation) => generation + 1);
      setSnapshot(EMPTY_BATCH);
    });
    return () => {
      unsubscribe();
      controller.dispose();
      if (batcher.current === controller) batcher.current = null;
    };
  }, [client, queryClient, userId, applyApiScores, queueGeneration]);

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
    // The click endpoint has no critical-hit field; its score uses the signed-in member's actual click power.
    const points = me.clicker.clickPower;
    if (!batcher.current.enqueue(points)) return null;
    setCancelledClicks(0);
    applyApiTap(points);
    return points;
  }, [ready, me, applyApiTap]);

  const notice = snapshot.error
    ? `${errorMessage(snapshot.error)} 미확정 ${snapshot.pendingClicks}회 전송을 보류했습니다. 중복 적립 방지를 위해 추가 클릭과 재전송을 중단했습니다. 새로고침하면 미확정 클릭은 사라지며 서버에 반영된 점수만 남습니다.`
    : cancelledClicks > 0
      ? `세션 종료로 미확정 ${cancelledClicks}회 전송을 중단했습니다. 이미 전송한 요청은 반영되었을 수 있으므로 다시 로그인해 점수를 확인해 주세요.`
      : !signedIn
        ? '클릭 점수를 적립하려면 로그인해 주세요.'
        : !ready ? '내 정보를 불러온 뒤 클릭할 수 있습니다.' : null;
  return { tap, notice, getPendingScore };
}

export const useCampusClicks = selectByMode({ api: useApiCampusClicks, mock: useMockCampusClicks });
