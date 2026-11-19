// Guest inquiry, POST /api/v1/supports (SupportController.create, SCRUM-164). Sent without a token: a token that the
// server cannot accept is a 401 there, and this form is the guest one. Order on the server: SupportBotCheck (from the
// third inquiry per IP in an hour, when Turnstile is on) before SupportRateLimiter (5 per IP per hour, then 429).

import type { ApiClient } from './client';
import { isApiError } from './errors';

/** SupportCreateRequest without the member-only attachment. */
export interface GuestSupportRequest {
  recipientEmail: string;
  title: string;
  content: string;
  /** Undefined sends no field (the server then asks for a check); '' means the widget did not load (plan P6). */
  turnstileToken?: string;
}

/** SupportCreateResponse. */
export interface SupportCreated {
  supportId: number;
  status: string;
}

export function createGuestSupport(client: ApiClient, request: GuestSupportRequest, signal?: AbortSignal): Promise<SupportCreated> {
  const { turnstileToken, ...form } = request;
  const body = turnstileToken === undefined ? form : { ...form, turnstileToken };
  return client.request<SupportCreated>('/supports', { method: 'POST', body, signal, anonymous: true });
}

export type GuestSupportError = 'verification-required' | 'verification-failed' | 'too-many' | 'other';

export function classifyGuestSupportError(error: unknown): GuestSupportError {
  if (!isApiError(error)) return 'other';
  if (error.status === 403 && error.code === 'ABUSE_VERIFICATION_REQUIRED') return 'verification-required';
  if (error.status === 403 && error.code === 'ABUSE_VERIFICATION_FAILED') return 'verification-failed';
  if (error.status === 429) return 'too-many';
  return 'other';
}
