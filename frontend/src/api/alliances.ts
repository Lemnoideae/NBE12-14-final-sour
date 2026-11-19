// Alliance create and detail (SCRUM-177, plan .agents/01-PLAN/261119-1123-scrum177_alliance_create_detail.md).
// AllianceController: POST /api/v1/alliances (201) and GET /api/v1/alliances/{id}. The server has no "my alliance",
// alliance list or member list yet, so this browser remembers the alliance its member created.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from './ApiProvider';
import type { ApiClient } from './client';

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

export const ALLIANCE_LIMITS = { nameMax: 50, minHours: 6, maxHours: 72, defaultHours: 24 } as const;
export const ALLIANCE_DURATION_PRESETS = [6, 12, 24, 48, 72] as const;

export const ALLIANCE_ERROR_CODES = {
  alreadyJoined: 'ALLY_UNIVERSITY_ALREADY_JOINED',
  notActiveUser: 'ALLY_USER_NOT_ACTIVE',
  notFound: 'ALLY_NOT_FOUND',
} as const;

export const ALLIANCE_STATUS_LABEL: Record<AllianceStatus, string> = { ACTIVE: '활동 중', IN_MATCH: '대결 중', EXPIRED: '만료' };

export function createAlliance(client: ApiClient, request: AllianceCreateRequest): Promise<Alliance> {
  return client.request<Alliance>('/alliances', { method: 'POST', body: request });
}

export function getAlliance(client: ApiClient, allianceId: number, signal?: AbortSignal): Promise<Alliance> {
  return client.get<Alliance>(`/alliances/${allianceId}`, { signal });
}

/** Keyed by the member, so one member's alliance never shows from another member's cache. */
export const allianceKeys = {
  all: ['alliances'] as const,
  detail: (userId: number, allianceId: number) => ['alliances', userId, 'detail', allianceId] as const,
};

/** The form's name as the server stores it, or the problem to show. Length counts UTF-16 units like @Size. */
export function validateAllianceName(input: string): { name: string } | { problem: string } {
  const name = input.trim();
  if (!name) return { problem: '연합 이름을 입력해 주세요.' };
  if (name.length > ALLIANCE_LIMITS.nameMax) return { problem: `연합 이름은 ${ALLIANCE_LIMITS.nameMax}자 이하로 입력해 주세요.` };
  return { name };
}

/** A positive safe integer typed by the member, or the problem to show. */
export function parseAllianceId(input: string): { allianceId: number } | { problem: string } {
  const value = input.trim();
  if (!value) return { problem: '연합 ID를 입력해 주세요.' };
  const allianceId = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(allianceId) || allianceId < 1) return { problem: '연합 ID는 1 이상의 정수로 입력해 주세요.' };
  return { allianceId };
}

// ---- The alliance this browser's member created (until GET /alliances/me exists). ----

export interface AllianceMemory {
  get(userId: number): number | null;
  set(userId: number, allianceId: number): void;
  forget(userId: number): void;
}

const memoryKey = (userId: number) => `sour.alliance.created.v1:${userId}`;

/**
 * localStorage, per member. Storage can be missing or throw (private window, blocked site data), so every access is
 * guarded and the screen works without it: the member just has to look the alliance up by ID again.
 */
export function createAllianceMemory(storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined
  = () => globalThis.localStorage): AllianceMemory {
  return {
    get(userId) {
      try {
        const raw = storage()?.getItem(memoryKey(userId));
        const parsed = raw === null || raw === undefined ? NaN : Number(raw);
        return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
      } catch {
        return null;
      }
    },
    set(userId, allianceId) {
      try { storage()?.setItem(memoryKey(userId), String(allianceId)); } catch { /* the screen still shows the alliance */ }
    },
    forget(userId) {
      try { storage()?.removeItem(memoryKey(userId)); } catch { /* nothing to undo */ }
    },
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
