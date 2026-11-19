// Auth session for API mode (SCRUM-148). Plan: .agents/01-PLAN/261118-1021-frontend_prototype_migration_plan.md §5 단계 0-4.
// The access token lives only in memory, never in localStorage, so a script injected into the page cannot read it
// after a reload. After a reload the session comes back through reissue with the refresh cookie (SCRUM-152).

import type { ApiError } from './errors';

/**
 * Codes that end the session in this browser and send the user to the login screen. Reissue cannot fix them:
 * - AUTH_SESSION_REPLACED: logged in on another device (AccessTokenAuthenticator, TokenReissueService)
 * - USER_SUSPENDED: the account was suspended (ClickActionGuard, ChatMessageService, UserService)
 * - AUTH_INVALID_REFRESH_TOKEN: the refresh cookie is missing, used or expired (RefreshTokenService)
 */
export const SESSION_ENDING_CODES = {
  AUTH_SESSION_REPLACED: 'replaced',
  USER_SUSPENDED: 'suspended',
  AUTH_INVALID_REFRESH_TOKEN: 'expired',
} as const;

export type SessionEndReason = (typeof SESSION_ENDING_CODES)[keyof typeof SESSION_ENDING_CODES];

export function sessionEndReason(code: string): SessionEndReason | null {
  return Object.hasOwn(SESSION_ENDING_CODES, code) ? SESSION_ENDING_CODES[code as keyof typeof SESSION_ENDING_CODES] : null;
}

/** Why a signed-in session ended, for the login screen's notice. */
export interface SessionEnd {
  reason: SessionEndReason;
  code: string;
  /** The server's message, e.g. "다른 기기에서 로그인해 로그아웃되었습니다. 다시 로그인해주세요." */
  message: string;
}

export type SessionState =
  | { status: 'signed-in'; accessToken: string }
  /** `ended` is null when the user never signed in or signed out by choice. */
  | { status: 'signed-out'; ended: SessionEnd | null };

export interface AuthSession {
  getState(): SessionState;
  getAccessToken(): string | null;
  /** After login or reissue. */
  signIn(accessToken: string): void;
  /** Logout by choice: no notice on the login screen. */
  signOut(): void;
  /**
   * Ends a signed-in session because of `error` (one of SESSION_ENDING_CODES). Does nothing when already signed
   * out, so a failed session restore on first visit shows no "logged out" notice.
   */
  end(error: ApiError): void;
  subscribe(listener: () => void): () => void;
}

const SIGNED_OUT: SessionState = { status: 'signed-out', ended: null };

export function createAuthSession(): AuthSession {
  let state: SessionState = SIGNED_OUT;
  const listeners = new Set<() => void>();
  const set = (next: SessionState) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    getState: () => state,
    getAccessToken: () => (state.status === 'signed-in' ? state.accessToken : null),
    signIn(accessToken) {
      if (!accessToken) throw new Error('빈 access 토큰으로 로그인할 수 없습니다.');
      set({ status: 'signed-in', accessToken });
    },
    signOut() {
      if (state !== SIGNED_OUT) set(SIGNED_OUT);
    },
    end(error) {
      if (state.status !== 'signed-in') return;
      const reason = sessionEndReason(error.code);
      if (!reason) throw new Error(`세션을 끝내는 코드가 아닙니다: ${error.code}`);
      set({ status: 'signed-out', ended: { reason, code: error.code, message: error.message } });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
