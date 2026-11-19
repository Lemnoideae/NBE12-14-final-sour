// SCRUM-133: ChatMessageResponse / ChatMessagePageResponse; subscribe and REST history share this schema.
import type { ApiClient } from './client';
import { ApiError, CLIENT_ERROR_CODES } from './errors';

export const CHAT_PAGE_SIZE = 20;
export const CHAT_MAX_LENGTH = 200;
export const CHAT_SEND_DESTINATION = '/app/chat/university';
export const CHAT_ERROR_DESTINATION = '/user/queue/errors';
export const chatTopic = (universityId: number) => `/topic/chat/universities/${universityId}`;

export interface ChatMessage {
  messageId: string;
  roomId: string;
  userId: number;
  nickname: string;
  universityName: string;
  content: string;
  createdAt: string;
}
export interface ChatPage { items: ChatMessage[]; nextCursor: string | null; hasNext: boolean }
export interface ChatFault { code: string; message: string }
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
export const invalidChatResponse = () => new ApiError({ kind: 'invalid-response', status: null, code: CLIENT_ERROR_CODES.invalidResponse });

export function isChatMessage(value: unknown, universityId: number): value is ChatMessage {
  return record(value) && typeof value.messageId === 'string' && ULID.test(value.messageId)
    && value.roomId === `UNIV#${universityId}` && Number.isSafeInteger(value.userId) && Number(value.userId) > 0
    && typeof value.nickname === 'string' && typeof value.universityName === 'string' && typeof value.content === 'string'
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt));
}

export function parseChatMessage(body: string, universityId: number): ChatMessage {
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw invalidChatResponse(); }
  if (!isChatMessage(value, universityId)) throw invalidChatResponse();
  return value;
}

export function parseChatFault(body: string): ChatFault {
  try {
    const value: unknown = JSON.parse(body);
    if (record(value) && typeof value.code === 'string' && typeof value.message === 'string') {
      return { code: value.code, message: value.message };
    }
  } catch { /* An unreadable frame must not expose raw protocol data or credentials. */ }
  return { code: CLIENT_ERROR_CODES.invalidResponse, message: invalidChatResponse().message };
}

/** Java counts code points, not UTF-16 units: do not use maxlength=200 for emoji text. */
export function validateChatContent(input: string): { content: string } | { problem: string } {
  const content = input.trim();
  const length = Array.from(content).length;
  return length < 1 || length > CHAT_MAX_LENGTH ? { problem: '메시지는 공백을 제외한 앞뒤를 정리한 뒤 1~200자로 입력해 주세요.' } : { content };
}

/** Immutable, server-owned messages only; ULID order is the server's history cursor order. */
export function mergeChatMessages(current: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((item) => [item.messageId, item]));
  for (const item of incoming) byId.set(item.messageId, item);
  return [...byId.values()].sort((a, b) => a.messageId < b.messageId ? -1 : a.messageId > b.messageId ? 1 : 0);
}

export async function getChatHistory(client: ApiClient, universityId: number, cursor?: string, signal?: AbortSignal): Promise<ChatPage> {
  const page = await client.get<unknown>(`/chat/universities/${universityId}/messages`, { query: { size: CHAT_PAGE_SIZE, cursor }, signal });
  if (!record(page) || !Array.isArray(page.items) || !page.items.every((item) => isChatMessage(item, universityId))
    || typeof page.hasNext !== 'boolean' || !(page.nextCursor === null || typeof page.nextCursor === 'string' && ULID.test(page.nextCursor))
    || (page.hasNext && (!page.nextCursor || page.nextCursor === cursor))) throw invalidChatResponse();
  return { items: page.items, nextCursor: page.nextCursor, hasNext: page.hasNext };
}

export async function getForbiddenWords(client: ApiClient, signal?: AbortSignal): Promise<string[]> {
  const value = await client.get<unknown>('/forbidden-words', { signal });
  if (!record(value) || !Array.isArray(value.words) || !value.words.every((word) => typeof word === 'string')) throw invalidChatResponse();
  return value.words;
}
