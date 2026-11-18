// The signed-in member's own profile (SCRUM-153): GET /api/v1/users/me (UserController.me, MyInfoResponse.java).

import { useQuery } from '@tanstack/react-query';
import { useApiClient, useAuthSession } from './ApiProvider';
import type { ApiClient } from './client';
import type { UserRole } from './auth';

/** `UserStatus.java`, in declaration order (checked by tests/apiMyInfo.test.ts). */
export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** `MyInfoResponse`. Scores are Redis live values when the server has them, otherwise the DB values. */
export interface MyInfo {
  id: number;
  nickname: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  profileImageUrl: string | null;
  university: { id: number; name: string; logoUrl: string | null };
  department: { id: number; name: string };
  /** `level` is the clicker ID; `nextLevelRequiredScore` is null at the top level. */
  clicker: { level: number; clickPower: number; nextLevelRequiredScore: number | null };
  totalContribScore: number;
  totalAttackScore: number;
}

/** Needs a signed-in session; without one the server answers 401 COMMON_UNAUTHORIZED. */
export function getMyInfo(client: ApiClient): Promise<MyInfo> {
  return client.get<MyInfo>('/users/me');
}

export const userKeys = {
  /** Belongs to whoever is signed in, so its data is reset on sign-out (ApiSessionWatcher). */
  me: ['users', 'me'] as const,
};

/** The profile while signed in. Signed out, the query stays idle and has no data. */
export function useMyInfo() {
  const client = useApiClient();
  const signedIn = useAuthSession().status === 'signed-in';
  return useQuery({ queryKey: userKeys.me, queryFn: () => getMyInfo(client), enabled: signedIn });
}

/** Whether to show the admin menu (SCRUM-171). The server checks the role again on every admin call. */
export function useIsAdmin(): boolean {
  const me = useMyInfo();
  return useAuthSession().status === 'signed-in' && me.data?.role === 'ADMIN';
}

/** What the game screens take from the profile. Clicker power and costs stay on the mock table until SCRUM-157. */
export interface AccountProfile {
  userId: string;
  schoolId: number;
  department: string;
  nickname: string;
  email: string;
  contribution: number;
  clickerLevel: number;
}

export function accountFromMyInfo(info: MyInfo): AccountProfile {
  return {
    userId: String(info.id),
    schoolId: info.university.id,
    department: info.department.name,
    nickname: info.nickname,
    email: info.email,
    contribution: info.totalContribScore,
    clickerLevel: info.clicker.level,
  };
}
