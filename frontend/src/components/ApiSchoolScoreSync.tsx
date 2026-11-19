import React, { useEffect, useRef } from 'react';
import { useAuthSession } from '../api/ApiProvider';
import { useMySchoolRanking } from '../api/rankings';
import { useMyInfo } from '../api/users';
import { useMockGame } from '../hooks/useMockGame';

interface ApiSchoolScoreSyncProps {
  getPendingScore: () => number;
  isSending: () => boolean;
}

/**
 * Mounted once at the app root in API mode (SCRUM-188): the main HUD's school score is the server's
 * `myUniversity.totalScore`, refetched every 30 seconds, plus this member's clicks the server has not confirmed yet.
 * It shares the query that feeds the HUD rank, so it adds no request. Until the first answer the game keeps its value.
 *
 * Click answers carry a newer total and still apply at once. Two rules keep an older ranking total from replacing one:
 * a ranking answer is skipped while a click batch is on its way (it may or may not count it), and a click answer
 * cancels a ranking request already in flight (useApiCampusClicks).
 */
export const ApiSchoolScoreSync: React.FC<ApiSchoolScoreSyncProps> = ({ getPendingScore, isSending }) => {
  const signedIn = useAuthSession().status === 'signed-in';
  const viewerId = useMyInfo().data?.id ?? null;
  const ranking = useMySchoolRanking(signedIn ? viewerId : null);
  const { applyApiSchoolScore } = useMockGame();
  const latest = useRef({ applyApiSchoolScore, getPendingScore, isSending, mine: ranking.data });
  latest.current = { applyApiSchoolScore, getPendingScore, isSending, mine: ranking.data };
  useEffect(() => {
    const { mine, isSending: sending, getPendingScore: pending, applyApiSchoolScore: apply } = latest.current;
    if (mine === undefined || sending()) return;
    // Null: the ranking has no score for the school yet, which the click script also starts from 0.
    apply((mine?.totalScore ?? 0) + pending());
    // The data too: two answers within one millisecond share dataUpdatedAt.
  }, [ranking.data, ranking.dataUpdatedAt]);
  return null;
};
