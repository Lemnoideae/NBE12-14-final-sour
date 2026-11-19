import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient, useAuthSession } from '../api/ApiProvider';
import { submitAttack, type AttackResponse } from '../api/attacks';
import { isClickLimitError, requiresClickVerification } from '../api/abuse';
import { errorMessage } from '../api/errors';
import { selectByMode } from '../api/mode';
import { universityKeys, type UniversityDetail } from '../api/universities';
import { userKeys, useMyInfo, type MyInfo } from '../api/users';
import { createClickBatcher, type ClickBatchSnapshot } from '../utils/clickBatcher';
import type { ClickUpgradeGate } from './useCampusClicks';

export interface CampusAttacks {
  ready: boolean;
  myUniversityId: number | null;
  pendingTargetId: number | null;
  pendingClicks: number;
  blocked: boolean;
  tap: (targetId: number) => boolean;
  result: AttackResponse | null;
  notice: string | null;
  retryLimited: (() => void) | null;
  botCheck: { open: boolean; onOpen: () => void; onClose: () => void; onVerified: () => void } | null;
}
const EMPTY: ClickBatchSnapshot = { pendingClicks: 0, pendingScore: 0, sending: false, error: null, recoverable: false, locked: false };
type AttackBatcher = ReturnType<typeof createClickBatcher<AttackResponse>>;

/** App-root lifetime: navigation does not discard attacks or change a queued batch's target. No optimistic damage. */
export function useApiCampusAttacks(beginAction: ClickUpgradeGate['beginUpgrade']): CampusAttacks {
  const client = useApiClient();
  const signedIn = useAuthSession().status === 'signed-in';
  const me = useMyInfo();
  const userId = signedIn ? me.data?.id : undefined;
  const queryClient = useQueryClient();
  const queue = useRef<AttackBatcher | null>(null);
  const target = useRef<number | null>(null);
  const release = useRef<(() => void) | null>(null);
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [pendingTargetId, setPendingTargetId] = useState<number | null>(null);
  const [result, setResult] = useState<AttackResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [botOpen, setBotOpen] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (userId === undefined) return;
    // Also cancel client-side fault delays: otherwise a delayed request could pick up the next account's token.
    const abort = new AbortController();
    const unlock = () => { release.current?.(); release.current = null; target.current = null; setPendingTargetId(null); };
    const controller = createClickBatcher<AttackResponse>({
      send: (body) => {
        if (target.current === null) throw new Error('공격 대상이 없습니다.');
        return submitAttack(client, { ...body, targetUniversityId: target.current }, abort.signal);
      },
      onChange(next) {
        setSnapshot(next);
        if (next.pendingClicks === 0) unlock();
      },
      async onAccepted(response) {
        // Polling started before this attack must not overwrite the accepted score with an older response.
        const key = universityKeys.detail(response.targetUniversity.id, userId);
        await Promise.all([
          queryClient.cancelQueries({ queryKey: key, exact: true }),
          queryClient.cancelQueries({ queryKey: userKeys.me, exact: true }),
        ]);
        if (queue.current !== controller || client.session.getState().status !== 'signed-in') return;
        queryClient.setQueryData<UniversityDetail>(key, (current) => current
          ? { ...current, totalScore: response.targetUniversity.totalScore, rank: response.targetUniversity.rank }
          : current);
        queryClient.setQueryData<MyInfo>(userKeys.me, (current) => current?.id === userId
          ? { ...current, totalAttackScore: response.myAttackScore } : current);
        setResult(response);
        setNotice(null);
      },
    });
    queue.current = controller;
    setSnapshot(EMPTY);
    setResult(null);
    setNotice(null);
    setBotOpen(false);
    const unsubscribe = client.session.subscribe(() => {
      if (client.session.getState().status === 'signed-in') return;
      const pending = controller.getSnapshot().pendingClicks;
      controller.dispose();
      abort.abort();
      if (queue.current === controller) queue.current = null;
      unlock();
      setSnapshot(EMPTY);
      setResult(null);
      setBotOpen(false);
      setNotice(pending ? `세션 종료로 미확정 공격 ${pending}회 전송을 중단했습니다. 이미 보낸 요청은 반영됐을 수 있으니 다시 로그인해 서버 점수를 확인해 주세요.` : null);
      setGeneration((value) => value + 1);
    });
    return () => {
      unsubscribe();
      controller.dispose();
      abort.abort();
      if (queue.current === controller) queue.current = null;
      unlock();
    };
  }, [client, queryClient, userId, generation]);

  const pending = snapshot.pendingClicks > 0;
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);
  const needsBot = signedIn && requiresClickVerification(snapshot.error);
  useEffect(() => { if (needsBot) setBotOpen(true); }, [needsBot]);

  const tap = useCallback((targetId: number) => {
    const current = queryClient.getQueryData<MyInfo>(userKeys.me);
    if (client.session.getState().status !== 'signed-in' || userId === undefined || current?.id !== userId
      || current.university.id === targetId || !queue.current) return false;
    if (target.current !== null && target.current !== targetId) {
      setNotice('이전 학교의 공격 전송이 끝난 뒤 새 학교를 공격할 수 있어요.');
      return false;
    }
    if (!release.current) {
      release.current = beginAction();
      if (!release.current) {
        setNotice('내 학교 클릭·구매·강화 전송이 끝난 뒤 공격할 수 있어요.');
        return false;
      }
    }
    target.current = targetId;
    setPendingTargetId(targetId);
    const accepted = queue.current.enqueue(0);
    if (accepted) setNotice(null);
    return accepted;
  }, [client, userId, queryClient, beginAction]);

  const retryLimited = useCallback(() => {
    if (queue.current?.discardRateLimitedBatch()) setNotice('서버가 거절한 공격은 제외했어요. 남은 대기 공격은 유지합니다.');
  }, []);
  const verified = useCallback(() => {
    const resumed = queue.current?.resumeAfterVerification();
    setBotOpen(false);
    if (!resumed) setNotice('이전 공격의 처리 여부가 불명확해 재전송하지 않았어요. 새로고침해 서버 점수를 확인해 주세요.');
  }, []);
  const failure = snapshot.error
    ? `${errorMessage(snapshot.error)} 미확정 공격 ${snapshot.pendingClicks}회는 보류 중입니다. 처리 여부가 불명확하면 재전송하지 않습니다. 새로고침하면 미확정 공격은 사라지고 서버 점수만 남습니다.`
    : null;
  return {
    ready: signedIn && userId !== undefined,
    myUniversityId: signedIn ? me.data?.university.id ?? null : null,
    pendingTargetId, pendingClicks: snapshot.pendingClicks, blocked: snapshot.error !== null, tap,
    result: signedIn ? result : null,
    notice: failure ? `${notice ? `${notice} ` : ''}${failure}` : notice,
    retryLimited: signedIn && snapshot.recoverable && isClickLimitError(snapshot.error) ? retryLimited : null,
    botCheck: needsBot ? { open: botOpen, onOpen: () => setBotOpen(true), onClose: () => setBotOpen(false), onVerified: verified } : null,
  };
}

const useMockCampusAttacks = (_beginAction: ClickUpgradeGate['beginUpgrade']): null => null;
export const useCampusAttacks = selectByMode<(beginAction: ClickUpgradeGate['beginUpgrade']) => CampusAttacks | null>({ api: useApiCampusAttacks, mock: useMockCampusAttacks });
