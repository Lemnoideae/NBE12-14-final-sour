// The one HTTP client every API call goes through (SCRUM-147). Plan: .agents/01-PLAN/261118-1021-frontend_prototype_migration_plan.md
// §5 단계 0-3. It calls the same origin (the Vite proxy forwards /api/, SCRUM-146), unwraps ApiResponse and turns
// every failure into ApiError. Access tokens and reissue come next (SCRUM-148).

import { ApiError, CLIENT_ERROR_CODES, parseFieldErrors } from './errors';
import { createApiFaults, type ApiFaults } from './faults';

/** Every endpoint is under /api/v1 (decision 2026-11-12); paths passed to the client start after it. */
export const API_BASE_PATH = '/api/v1';
/** ApiResponse.SUCCESS_CODE */
export const SUCCESS_CODE = 'SUCCESS';
/** Bad Gateway, Service Unavailable, Gateway Timeout: answered by a proxy in front of the backend. */
const GATEWAY_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

export type QueryValue = string | number | boolean | null | undefined;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  /** Added as ?key=value; null and undefined values are left out. */
  query?: Readonly<Record<string, QueryValue>>;
  /** FormData goes as multipart (the logo item, ItemController); anything else as JSON. */
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiClient {
  /**
   * Resolves to ApiResponse.data. The type is the caller's claim: the body is not validated at run time, so each
   * domain module declares the response type from the backend DTO it calls.
   */
  request<T>(path: string, options?: ApiRequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T>;
  /** The test tool's delay and failure injection for this client. */
  readonly faults: ApiFaults;
}

export interface ApiClientOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
  faults?: ApiFaults;
}

interface ApiResponseBody {
  code: string;
  message: string;
  data: unknown;
}

function isApiResponseBody(body: unknown): body is ApiResponseBody {
  return typeof body === 'object' && body !== null
    && typeof (body as ApiResponseBody).code === 'string'
    && typeof (body as ApiResponseBody).message === 'string';
}

export function buildUrl(baseUrl: string, path: string, query?: Readonly<Record<string, QueryValue>>): string {
  if (!path.startsWith('/')) throw new Error(`API 경로는 /로 시작해야 합니다: ${path}`);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) params.append(key, String(value));
  }
  const search = params.toString();
  return `${baseUrl}${path}${search ? `?${search}` : ''}`;
}

function encodeBody(body: unknown): { body?: BodyInit; contentType?: string } {
  if (body === undefined) return {};
  // The browser sets the multipart boundary itself, so no Content-Type here.
  if (body instanceof FormData) return { body };
  return { body: JSON.stringify(body), contentType: 'application/json' };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const baseUrl = options.baseUrl ?? API_BASE_PATH;
  const faults = options.faults ?? createApiFaults();

  async function request<T>(path: string, { method = 'GET', query, body, signal }: ApiRequestOptions = {}): Promise<T> {
    const url = buildUrl(baseUrl, path, query);
    await faults.beforeRequest(signal);

    const encoded = encodeBody(body);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (encoded.contentType) headers['Content-Type'] = encoded.contentType;

    let response: Response;
    try {
      // same-origin: the refresh cookie (Path=/api/v1/auth, SameSite=Strict) goes only to our own origin.
      response = await doFetch(url, { method, headers, body: encoded.body, signal, credentials: 'same-origin' });
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw new ApiError({ kind: 'network', status: null, code: CLIENT_ERROR_CODES.network, cause: error });
    }

    // 204 has no body by definition; the backend always sends ApiResponse otherwise.
    if (response.status === 204) return undefined as T;
    const parsed = await readBody(response);
    if (!isApiResponseBody(parsed)) {
      // A gateway status without our body means the proxy could not reach the backend: the Vite proxy answers an
      // empty 502 when the backend is down (checked 2026-11-18). Tell the user it is a connection problem.
      if (GATEWAY_STATUSES.has(response.status)) {
        throw new ApiError({ kind: 'network', status: response.status, code: CLIENT_ERROR_CODES.network });
      }
      throw new ApiError({ kind: 'invalid-response', status: response.status, code: CLIENT_ERROR_CODES.invalidResponse });
    }
    if (response.ok && parsed.code === SUCCESS_CODE) return parsed.data as T;
    throw new ApiError({
      kind: 'http',
      status: response.status,
      code: parsed.code,
      serverMessage: parsed.message,
      fieldErrors: parseFieldErrors(parsed.data),
    });
  }

  return {
    request,
    get: (path, getOptions) => request(path, { ...getOptions, method: 'GET' }),
    faults,
  };
}
