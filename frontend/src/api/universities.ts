// University search, GET /api/v1/universities (UniversityController.searchUniversities). Public: no login needed
// (SecurityConfig). The mock implementation comes with the numeric school IDs (SCRUM-149).

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './ApiProvider';
import type { ApiClient } from './client';

/** UniversitySearchResponse. logo_url is a nullable column (V1__init.sql), so logoUrl can be null. */
export interface UniversitySummary {
  id: number;
  name: string;
  logoUrl: string | null;
}

/** The backend's default `size`; it accepts 1–100. */
export const UNIVERSITY_SEARCH_SIZE = 20;

export function searchUniversities(
  client: ApiClient,
  keyword: string,
  { size = UNIVERSITY_SEARCH_SIZE, signal }: { size?: number; signal?: AbortSignal } = {},
): Promise<UniversitySummary[]> {
  return client.get<UniversitySummary[]>('/universities', { query: { keyword, size }, signal });
}

export const universityKeys = {
  all: ['universities'] as const,
  search: (keyword: string, size: number) => [...universityKeys.all, 'search', { keyword, size }] as const,
};

/** Search results for a trimmed keyword. A blank keyword sends nothing: the backend rejects it (@NotBlank). */
export function useUniversitySearch(keyword: string, size = UNIVERSITY_SEARCH_SIZE) {
  const client = useApiClient();
  const trimmed = keyword.trim();
  return useQuery({
    queryKey: universityKeys.search(trimmed, size),
    queryFn: ({ signal }) => searchUniversities(client, trimmed, { size, signal }),
    enabled: trimmed.length > 0,
  });
}
