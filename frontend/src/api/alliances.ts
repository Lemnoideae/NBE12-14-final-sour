// Alliance create and detail (SCRUM-177), join applications (SCRUM-178), matches (SCRUM-179). Plans in
// .agents/01-PLAN/261119-1123-*, -1134-* and -1150-*.
// AllianceController: POST /api/v1/alliances (201), GET /api/v1/alliances/{id}, POST /{id}/applications (201) and
// PATCH /applications/{id}/approve|reject. AllianceMatchController: POST /{id}/matches (201), GET /matches/{id} and
// PATCH /matches/{id}/accept|cancel. The server has no "my alliance", alliance list, member list, application list or
// match list yet, so this browser remembers its member's alliance, sent application and latest match, and applications
// and matches are handled by number.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from './ApiProvider';
import type { ApiClient } from './client';
import { getUniversityDetail, universityKeys } from './universities';

export type AllianceStatus = 'ACTIVE' | 'IN_MATCH' | 'EXPIRED';

/** AllianceResponse. */
export interface Alliance {
  id: number;
  name: string;
  totalScore: number;
  status: AllianceStatus;
  durationHours: number;
  /** ISO-8601 with offset. */
  expiredAt: string;
}

/** AllianceCreateRequest: `name` @NotBlank @Size(max = 50) and trimmed by Alliance.create, `durationHours` 6–72. */
export interface AllianceCreateRequest {
  name: string;
  durationHours: number;
}

export type AllianceApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'LEFT';

/** AllianceApplicationResponse: one school's membership row in an alliance. */
export interface AllianceApplication {
  id: number;
  allianceId: number;
  universityId: number;
  status: AllianceApplicationStatus;
}

export type AllianceMatchStatus = 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELED';

/**
 * AllianceMatchResponse. A requested, B received. `aScore`/`bScore` stay 0 in the database until settlement writes the
 * final scores, so they mean something only once the match has FINISHED.
 */
export interface AllianceMatch {
  id: number;
  allianceAId: number;
  allianceBId: number;
  winnerAllianceId: number | null;
  status: AllianceMatchStatus;
  durationHours: number;
  /** ISO-8601 with offset: B must accept before this. */
  requestExpiredAt: string;
  scheduledStartAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  aScore: number;
  bScore: number;
}

export const MATCH_LIMITS = { minHours: 1, maxHours: 24, defaultHours: 6 } as const;
export const MATCH_DURATION_PRESETS = [1, 3, 6, 12, 24] as const;
export const MATCH_STATUS_LABEL: Record<AllianceMatchStatus, string> = {
  REQUESTED: '수락 대기', SCHEDULED: '예약됨', IN_PROGRESS: '진행 중', FINISHED: '종료', CANCELED: '취소됨',
};
export const MATCH_ERROR_CODES = {
  alreadyRequested: 'MATCH_ALREADY_REQUESTED',
  notFound: 'MATCH_NOT_FOUND',
  notPending: 'MATCH_NOT_PENDING',
  requestExpired: 'MATCH_REQUEST_EXPIRED',
  membersIncomplete: 'MATCH_MEMBERS_INCOMPLETE',
  scheduleConflict: 'MATCH_SCHEDULE_CONFLICT',
  invalidSchedule: 'MATCH_INVALID_SCHEDULE',
  insufficientTime: 'MATCH_INSUFFICIENT_TIME',
} as const;
/** While a match can still change by itself (accepted, expired, ended), its card reads it again this often. */
export const MATCH_REFRESH_MS = 15_000;

/** AllianceService.MAX_ALLIANCE_SIZE: the founder plus one approved school. */
export const ALLIANCE_MAX_SCHOOLS = 2;
export const ALLIANCE_LIMITS = { nameMax: 50, minHours: 6, maxHours: 72, defaultHours: 24 } as const;
export const ALLIANCE_DURATION_PRESETS = [6, 12, 24, 48, 72] as const;

export const ALLIANCE_ERROR_CODES = {
  alreadyJoined: 'ALLY_UNIVERSITY_ALREADY_JOINED',
  notActiveUser: 'ALLY_USER_NOT_ACTIVE',
  notFound: 'ALLY_NOT_FOUND',
  notJoinable: 'ALLY_NOT_ACTIVE',
  full: 'ALLY_FULL',
  applicationPending: 'ALLY_APPLICATION_PENDING',
  notMember: 'ALLY_NOT_MEMBER',
  applicationNotFound: 'ALLY_APPLICATION_NOT_FOUND',
  applicationNotPending: 'ALLY_APPLICATION_NOT_PENDING',
} as const;

export const ALLIANCE_STATUS_LABEL: Record<AllianceStatus, string> = { ACTIVE: '활동 중', IN_MATCH: '대결 중', EXPIRED: '만료' };

export function createAlliance(client: ApiClient, request: AllianceCreateRequest): Promise<Alliance> {
  return client.request<Alliance>('/alliances', { method: 'POST', body: request });
}

export function getAlliance(client: ApiClient, allianceId: number, signal?: AbortSignal): Promise<Alliance> {
  return client.get<Alliance>(`/alliances/${allianceId}`, { signal });
}

export function applyToAlliance(client: ApiClient, allianceId: number): Promise<AllianceApplication> {
  return client.request<AllianceApplication>(`/alliances/${allianceId}/applications`, { method: 'POST' });
}

export type ApplicationDecision = 'approve' | 'reject';

export function decideApplication(client: ApiClient, applicationId: number, decision: ApplicationDecision): Promise<AllianceApplication> {
  return client.request<AllianceApplication>(`/alliances/applications/${applicationId}/${decision}`, { method: 'PATCH' });
}

/** Omit scheduledStartAt to start on acceptance; otherwise send an ISO-8601 instant with an explicit offset. */
export interface MatchRequest {
  opponentAllianceId: number;
  durationHours: number;
  scheduledStartAt?: string;
}

export function requestMatch(client: ApiClient, allianceId: number, request: MatchRequest): Promise<AllianceMatch> {
  return client.request<AllianceMatch>(`/alliances/${allianceId}/matches`, { method: 'POST', body: request });
}

export function getMatch(client: ApiClient, matchId: number, signal?: AbortSignal): Promise<AllianceMatch> {
  return client.get<AllianceMatch>(`/alliances/matches/${matchId}`, { signal });
}

/** `cancel` is A withdrawing or B declining; the server records both as CANCELED. */
export type MatchDecision = 'accept' | 'cancel';

export function decideMatch(client: ApiClient, matchId: number, decision: MatchDecision): Promise<AllianceMatch> {
  return client.request<AllianceMatch>(`/alliances/matches/${matchId}/${decision}`, { method: 'PATCH' });
}

/** Keyed by the member, so one member's alliance never shows from another member's cache. */
export const allianceKeys = {
  all: ['alliances'] as const,
  detail: (userId: number, allianceId: number) => ['alliances', userId, 'detail', allianceId] as const,
  match: (userId: number, matchId: number) => ['alliances', userId, 'match', matchId] as const,
};

/** The form's name as the server stores it, or the problem to show. Length counts UTF-16 units like @Size. */
export function validateAllianceName(input: string): { name: string } | { problem: string } {
  const name = input.trim();
  if (!name) return { problem: '연합 이름을 입력해 주세요.' };
  if (name.length > ALLIANCE_LIMITS.nameMax) return { problem: `연합 이름은 ${ALLIANCE_LIMITS.nameMax}자 이하로 입력해 주세요.` };
  return { name };
}

/** A positive safe integer typed by the member, or null. */
function parsePositiveId(input: string): number | null {
  const value = input.trim();
  const id = /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function parseAllianceId(input: string): { allianceId: number } | { problem: string } {
  if (!input.trim()) return { problem: '연합 ID를 입력해 주세요.' };
  const allianceId = parsePositiveId(input);
  return allianceId === null ? { problem: '연합 ID는 1 이상의 정수로 입력해 주세요.' } : { allianceId };
}

export function parseMatchId(input: string): { matchId: number } | { problem: string } {
  if (!input.trim()) return { problem: '대결 번호를 입력해 주세요.' };
  const matchId = parsePositiveId(input);
  return matchId === null ? { problem: '대결 번호는 1 이상의 정수로 입력해 주세요.' } : { matchId };
}

export function parseApplicationId(input: string): { applicationId: number } | { problem: string } {
  if (!input.trim()) return { problem: '신청 번호를 입력해 주세요.' };
  const applicationId = parsePositiveId(input);
  return applicationId === null ? { problem: '신청 번호는 1 이상의 정수로 입력해 주세요.' } : { applicationId };
}

// ---- The alliance this browser's member created (until GET /alliances/me exists). ----

export interface AllianceMemory {
  get(userId: number): number | null;
  set(userId: number, allianceId: number): void;
  forget(userId: number): void;
}

/** The application this browser's member sent (until the server can list it). */
export interface SentApplication {
  applicationId: number;
  allianceId: number;
}

export interface SentApplicationMemory {
  get(userId: number): SentApplication | null;
  set(userId: number, application: SentApplication): void;
  forget(userId: number): void;
}

type MemoryStorage = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;
const memoryKey = (userId: number) => `sour.alliance.created.v1:${userId}`;
const applicationKey = (userId: number) => `sour.alliance.application.v1:${userId}`;
const matchKey = (userId: number) => `sour.alliance.match.v1:${userId}`;

/**
 * Storage can be missing or throw (private window, blocked site data), so every access is guarded and the screen works
 * without it: the member just has to look the alliance up by ID again.
 */
function guarded(storage: MemoryStorage) {
  return {
    read(key: string): string | null {
      try { return storage()?.getItem(key) ?? null; } catch { return null; }
    },
    write(key: string, value: string) {
      try { storage()?.setItem(key, value); } catch { /* the screen still shows it */ }
    },
    remove(key: string) {
      try { storage()?.removeItem(key); } catch { /* nothing to undo */ }
    },
  };
}

const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

function idMemory(key: (userId: number) => string, storage: MemoryStorage): AllianceMemory {
  const store = guarded(storage);
  return {
    get(userId) {
      const raw = store.read(key(userId));
      const parsed = raw === null ? NaN : Number(raw);
      return positiveId(parsed) ? parsed : null;
    },
    set(userId, id) { store.write(key(userId), String(id)); },
    forget(userId) { store.remove(key(userId)); },
  };
}

/** localStorage, per member: the alliance this member created or chose to remember. */
export function createAllianceMemory(storage: MemoryStorage = () => globalThis.localStorage): AllianceMemory {
  return idMemory(memoryKey, storage);
}

/** localStorage, per member: the match this member requested or looked up last. Same shape as the alliance memory. */
export function createMatchMemory(storage: MemoryStorage = () => globalThis.localStorage): AllianceMemory {
  return idMemory(matchKey, storage);
}

/** localStorage, per member: the last join application this member sent. */
export function createSentApplicationMemory(storage: MemoryStorage = () => globalThis.localStorage): SentApplicationMemory {
  const store = guarded(storage);
  return {
    get(userId) {
      const raw = store.read(applicationKey(userId));
      if (raw === null) return null;
      try {
        const value = JSON.parse(raw) as Partial<SentApplication>;
        return positiveId(value.applicationId) && positiveId(value.allianceId)
          ? { applicationId: value.applicationId, allianceId: value.allianceId } : null;
      } catch {
        return null;
      }
    },
    set(userId, application) { store.write(applicationKey(userId), JSON.stringify(application)); },
    forget(userId) { store.remove(applicationKey(userId)); },
  };
}

export function useAllianceDetail(userId: number, allianceId: number | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: allianceKeys.detail(userId, allianceId ?? 0),
    queryFn: ({ signal }) => getAlliance(client, allianceId!, signal),
    enabled: allianceId !== null,
    // Score and status change on the server; every visit checks again.
    staleTime: 0,
  });
}

export function useCreateAlliance(userId: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AllianceCreateRequest) => createAlliance(client, request),
    // Creating is not idempotent: a retry after a lost response could make a second alliance attempt. Let the member decide.
    retry: false,
    onSuccess: (alliance) => queryClient.setQueryData(allianceKeys.detail(userId, alliance.id), alliance),
  });
}

/** Join applications are not idempotent either: a lost response may have left one pending on the server. */
export function useApplyToAlliance() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (allianceId: number) => applyToAlliance(client, allianceId),
    retry: false,
  });
}

export function useDecideApplication(userId: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, decision }: { applicationId: number; decision: ApplicationDecision }) =>
      decideApplication(client, applicationId, decision),
    retry: false,
    onSuccess: (application) => queryClient.invalidateQueries({ queryKey: [...allianceKeys.all, userId, 'detail', application.allianceId] }),
  });
}

/** A school's name for an application row. Names do not change while the screen is open, so no polling. */
export function useUniversityName(universityId: number | null, viewerId: number) {
  const client = useApiClient();
  return useQuery({
    queryKey: universityKeys.detail(universityId ?? -1, viewerId),
    queryFn: ({ signal }) => getUniversityDetail(client, universityId!, { signal }),
    enabled: universityId !== null,
    staleTime: 5 * 60_000,
    select: (detail) => detail.name,
  });
}

const matchMayChange = (status: AllianceMatchStatus | undefined) => status === 'REQUESTED' || status === 'IN_PROGRESS';

export function useAllianceMatch(userId: number, matchId: number | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: allianceKeys.match(userId, matchId ?? 0),
    queryFn: ({ signal }) => getMatch(client, matchId!, signal),
    enabled: matchId !== null,
    staleTime: 0,
    refetchInterval: (query) => matchMayChange(query.state.data?.status) ? MATCH_REFRESH_MS : false,
  });
}

/** After a match changes, both alliances' status (ACTIVE/IN_MATCH) may have changed too. */
function refreshAfterMatch(queryClient: ReturnType<typeof useQueryClient>, userId: number, match: AllianceMatch) {
  queryClient.setQueryData(allianceKeys.match(userId, match.id), match);
  for (const allianceId of [match.allianceAId, match.allianceBId]) {
    void queryClient.invalidateQueries({ queryKey: allianceKeys.detail(userId, allianceId) });
  }
}

/** Not idempotent: a lost response may have left a request on the server, so the member decides whether to resend. */
export function useRequestMatch(userId: number, allianceId: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: MatchRequest) => requestMatch(client, allianceId, request),
    retry: false,
    onSuccess: (match) => refreshAfterMatch(queryClient, userId, match),
  });
}

export function useDecideMatch(userId: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, decision }: { matchId: number; decision: MatchDecision }) => decideMatch(client, matchId, decision),
    retry: false,
    onSuccess: (match) => refreshAfterMatch(queryClient, userId, match),
  });
}
