// The main screen's own-school rank and rank change (SCRUM-184). The API mode reads the server's `myUniversity`; the mock
// keeps the rank computed from the demo rows.

import { useMemo } from 'react';
import { useAuthSession } from '../api/ApiProvider';
import { selectByMode } from '../api/mode';
import { formatRankChange, useMySchoolRanking } from '../api/rankings';
import { useMyInfo } from '../api/users';
import { getSchoolRankings } from '../data/mockRankings';
import type { SchoolId } from '../data/schoolIds';

export interface MySchoolRank {
  /** Null until the server answers, signed out, or the school has no score yet: the HUD shows "순위 없음". */
  rank: number | null;
  /** Badge text (▲n, ▼n, -); null hides it. */
  change: string | null;
}

function useMockMySchoolRank(schoolScore: number, schoolId: SchoolId): MySchoolRank {
  return useMemo(() => {
    const mine = getSchoolRankings(schoolScore, schoolId).find((school) => school.isMySchool)!;
    return { rank: mine.rank, change: mine.change };
  }, [schoolScore, schoolId]);
}

// The demo score is not the server's, so the API mode ignores it.
export function useApiMySchoolRank(_schoolScore: number, _schoolId: SchoolId): MySchoolRank {
  const signedIn = useAuthSession().status === 'signed-in';
  const viewerId = useMyInfo().data?.id ?? null;
  const mine = useMySchoolRanking(signedIn ? viewerId : null).data ?? null;
  return { rank: mine?.rank ?? null, change: formatRankChange(mine?.rankChange) };
}

export const useMySchoolRank = selectByMode({ api: useApiMySchoolRank, mock: useMockMySchoolRank });
