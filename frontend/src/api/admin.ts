// Admin screens (SCRUM-171, plan .agents/01-PLAN/261119-1023-scrum172_admin_entry.md). The server guards every
// /api/v1/admin/** call with hasRole(ADMIN) read from the access token's `role` claim (SecurityConfig, JwtProvider):
// an anonymous call is 401, a member's is 403 COMMON_FORBIDDEN. GET /users/me reads the role from the database, so
// right after a member is made an admin the menu shows while the token still says USER until the next login.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useApiClient } from './ApiProvider';
import type { ApiClient } from './client';
import { isApiError } from './errors';
import { useIsAdmin, useMyInfo, userKeys } from './users';
import type { SupportStatus } from './supports';

/** ApiAccessDeniedHandler's answer to a signed-in member without the role. */
export const ADMIN_FORBIDDEN_CODE = 'COMMON_FORBIDDEN';

export function isAdminForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403 && error.code === ADMIN_FORBIDDEN_CODE;
}

export const adminKeys = {
  /** Admin data belongs to whoever is signed in and is reset on sign-out (ApiSessionWatcher). */
  all: ['admin'] as const,
  pendingSupports: (adminId: number) => ['admin', adminId, 'supports', 'pending-count'] as const,
};

/** AdminSupportListResponse; the items are typed with the support list screen (SCRUM-173). */
interface AdminSupportPage {
  items: unknown[];
  page: number;
  size: number;
  totalCount: number;
  hasNext: boolean;
}

const PENDING_STATUS: SupportStatus = 'RECEIVED';

/** How many inquiries wait for an answer: one row of GET /admin/supports?status=RECEIVED, read for its totalCount. */
export async function getPendingSupportCount(client: ApiClient, signal?: AbortSignal): Promise<number> {
  const page = await client.get<AdminSupportPage>('/admin/supports', { query: { status: PENDING_STATUS, page: 0, size: 1 }, signal });
  return page.totalCount;
}

/**
 * The admin home's count, which is also its access check: it runs only while the profile says ADMIN. A 403 means
 * the token disagrees with the profile, so the profile is read again; if it now says USER the menu disappears.
 */
export function useAdminPendingSupportCount() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const adminId = useMyInfo().data?.id ?? 0;
  const query = useQuery({
    queryKey: adminKeys.pendingSupports(adminId),
    queryFn: ({ signal }) => getPendingSupportCount(client, signal),
    enabled: isAdmin,
  });
  const forbidden = isAdminForbidden(query.error);
  useEffect(() => {
    if (forbidden) void queryClient.invalidateQueries({ queryKey: userKeys.me, exact: true });
  }, [forbidden, queryClient]);
  // Not spread: TanStack Query re-renders only for the result fields a component reads.
  return { query, forbidden };
}
