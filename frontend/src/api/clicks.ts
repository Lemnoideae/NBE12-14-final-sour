// ClickController, ClickRequest and ClickResponse (SCRUM-155).
import type { ApiClient } from './client';

export const CLICK_BATCH_WINDOW_MS = 1000;
export const MAX_CLICK_BATCH_SIZE = 20;

/**
 * ClickRequest also has optional `latitude`/`longitude` for the library bonus (#108). They are not sent until
 * SCRUM-185; without them the server never grants the bonus.
 */
export interface ClickRequest {
  submissionId: string;
  clickCount: number;
}

export interface ClickResponse {
  acceptedClicks: number;
  earnedScore: number;
  multiplier: number;
  myContribScore: number;
  university: { id: number; totalScore: number; rank: number; logoUrl: string };
  department: { id: number; totalScore: number };
  schoolClicksLastSecond: number;
  /** The click came from inside the school library: `multiplier` already includes its x1.2 (ClickService). */
  libraryBonus: boolean;
}

export function submitClicks(client: ApiClient, body: ClickRequest): Promise<ClickResponse> {
  return client.request<ClickResponse>('/clicks', { method: 'POST', body });
}
