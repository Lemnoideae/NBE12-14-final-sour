// ClickController, ClickRequest and ClickResponse (SCRUM-155).
import type { ApiClient } from './client';

export const CLICK_BATCH_WINDOW_MS = 1000;
export const MAX_CLICK_BATCH_SIZE = 20;

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
}

export function submitClicks(client: ApiClient, body: ClickRequest): Promise<ClickResponse> {
  return client.request<ClickResponse>('/clicks', { method: 'POST', body });
}
