// SCRUM-181. GuestBookController currently exposes GET and POST only; likes are read-only until SCRUM-137.
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from './ApiProvider';
import type { ApiClient } from './client';

/** GuestBookListResponse.Item. No author ID/profile image or total count is supplied. */
export interface GuestbookItem {
  id: number;
  content: string;
  likeCount: number;
  likedByMe: boolean;
  author: { nickname: string; universityName: string };
  createdAt: string;
}
export interface GuestbookPage {
  items: GuestbookItem[];
  nextCursor: string | null;
  hasNext: boolean;
}
export const GUESTBOOK_PAGE_SIZE = 20;
export const GUESTBOOK_MAX_LENGTH = 500;

/** Service validation counts Unicode code points, not UTF-16 units (emoji count as one). */
export function validateGuestbookContent(input: string): { content: string } | { problem: string } {
  const content = input.trim();
  if (!content) return { problem: '방명록 내용을 입력해 주세요.' };
  if ([...content].length > GUESTBOOK_MAX_LENGTH) return { problem: '방명록은 500자 이하로 입력해 주세요.' };
  return { content };
}

export function getGuestbooks(client: ApiClient, universityId: number, cursor: string | null, signal?: AbortSignal): Promise<GuestbookPage> {
  // Auth is optional, not anonymous: the server needs the member token for likedByMe.
  return client.get(`/universities/${universityId}/guestbooks`, { query: { size: GUESTBOOK_PAGE_SIZE, cursor: cursor ?? undefined }, signal });
}
export function createGuestbook(client: ApiClient, universityId: number, content: string): Promise<GuestbookItem> {
  return client.request(`/universities/${universityId}/guestbooks`, { method: 'POST', body: { content } });
}
export const guestbookKeys = {
  school: (universityId: number) => ['guestbooks', universityId] as const,
  list: (universityId: number, viewerId: number | null) => ['guestbooks', universityId, viewerId ?? 'guest'] as const,
};

/** Preserve the server's latest-first order; a concurrently inserted/refetched row must not appear twice. */
export function mergeGuestbookPages(pages: readonly GuestbookPage[], created?: GuestbookItem): GuestbookItem[] {
  const rows = new Map<number, GuestbookItem>();
  // Prefer a current list's count/likedByMe over the original creation response.
  for (const page of pages) for (const item of page.items) if (!rows.has(item.id)) rows.set(item.id, item);
  if (created && !rows.has(created.id)) return [created, ...rows.values()];
  return [...rows.values()];
}
export function useGuestbookPages(universityId: number, viewerId: number | null) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: guestbookKeys.list(universityId, viewerId),
    queryFn: ({ pageParam, signal }) => getGuestbooks(client, universityId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last, _pages, cursor, cursors) =>
      last.hasNext && last.nextCursor && last.nextCursor !== cursor && !cursors.includes(last.nextCursor) ? last.nextCursor : undefined,
    enabled: Number.isSafeInteger(universityId) && universityId > 0,
  });
}
export function useCreateGuestbook(universityId: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createGuestbook(client, universityId, content),
    retry: false,
    // All viewers of this school become stale, including the own-school view after another member posts.
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: guestbookKeys.school(universityId) }); },
  });
}
