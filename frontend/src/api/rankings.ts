// Rankings (SCRUM-161): GET /api/v1/rankings/universities[/{id}/departments, /{id}/users] (RankingController.java).
// Public endpoints; with a session the server adds the caller's own row (myUniversity, myDepartment, me).
// Ties share a rank. There is no rank-change field (plan D-3), so the screens hide the change badge in API mode.

import { useInfiniteQuery } from '@tanstack/react-query';
import { useApiClient } from './ApiProvider';
import type { ApiClient } from './client';

/** Rows per request. The backend accepts 1–100 and defaults to 20. */
export const RANKING_PAGE_SIZE = 20;
/** The screens say "5초마다 갱신". Paused while the tab is in the background (TanStack Query default). */
export const RANKING_REFRESH_MS = 5_000;

interface RankingPage<Item> {
  items: Item[];
  page: number;
  size: number;
  totalCount: number;
  hasNext: boolean;
}

/** UniversityRankingResponse. */
export interface UniversityRankingPage extends RankingPage<{
  rank: number; universityId: number; name: string; logoUrl: string | null; totalScore: number;
}> {
  myUniversity: { rank: number; universityId: number; totalScore: number } | null;
}

/** DepartmentRankingResponse. `myDepartment` is only set when the school is the caller's own. */
export interface DepartmentRankingPage extends RankingPage<{
  rank: number; departmentId: number; name: string; logoUrl: string | null; totalScore: number;
}> {
  myDepartment: { rank: number; departmentId: number; totalScore: number } | null;
}

/** UserRankingResponse. Private members are left out by the server; `me` is only set at the caller's own school. */
export interface UserRankingPage extends RankingPage<{
  rank: number; userId: number; nickname: string; profileImageUrl: string | null;
  department: { id: number; name: string } | null; contribScore: number;
}> {
  me: { rank: number; contribScore: number } | null;
}

export type RankingKind = 'school' | 'dept' | 'personal';
export interface RankingPageByKind {
  school: UniversityRankingPage;
  dept: DepartmentRankingPage;
  personal: UserRankingPage;
}

export function rankingPath(kind: RankingKind, universityId: number | null): string {
  if (kind === 'school') return '/rankings/universities';
  if (universityId === null) throw new Error('학과·개인 순위에는 학교 ID가 필요합니다.');
  return `/rankings/universities/${universityId}/${kind === 'dept' ? 'departments' : 'users'}`;
}

export function getRankingPage<K extends RankingKind>(
  client: ApiClient,
  kind: K,
  { universityId = null, page, size = RANKING_PAGE_SIZE, signal }: { universityId?: number | null; page: number; size?: number; signal?: AbortSignal },
): Promise<RankingPageByKind[K]> {
  // Not anonymous: a session token makes the server fill in the caller's own row.
  return client.get<RankingPageByKind[K]>(rankingPath(kind, universityId), { query: { page, size }, signal });
}

export const rankingKeys = {
  all: ['rankings'] as const,
  /** The viewer is part of the key: the caller's own row depends on who is signed in. */
  list: (kind: RankingKind, universityId: number | null, viewerId: number | null) =>
    [...rankingKeys.all, kind, universityId, viewerId ?? 'guest'] as const,
};

/**
 * Offset pages joined by scrolling. Nothing is sent while `enabled` is false (a school-scoped tab without a school).
 * A refetch reloads every page that was already open, so the joined list can repeat a row when ranks move between
 * pages; callers remove repeats by ID.
 */
export function useRankingPages<K extends RankingKind>(
  kind: K,
  { universityId, viewerId, enabled = true }: { universityId: number | null; viewerId: number | null; enabled?: boolean },
) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: rankingKeys.list(kind, universityId, viewerId),
    queryFn: ({ pageParam, signal }) => getRankingPage(client, kind, { universityId, page: pageParam, signal }),
    initialPageParam: 0,
    getNextPageParam: (last: RankingPageByKind[K]) => (last.hasNext ? last.page + 1 : undefined),
    enabled: enabled && (kind === 'school' || universityId !== null),
    refetchInterval: RANKING_REFRESH_MS,
  });
}
