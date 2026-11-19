// Delay and failure injection for the test tool (SCRUM-147, plan §4-2). It lives in the client, so it changes only
// this browser's requests and never reaches the server. Modes and timings are the mock request layer's
// (utils/mockRequest.ts), so the test tool works the same in api and mock mode.

import { MOCK_REQUEST_RULES, requestWaitMs, settleRequest, type MockRequestMode } from '../utils/mockRequest';
import { ApiError, CLIENT_ERROR_CODES } from './errors';

export type ApiFaultMode = MockRequestMode;

export interface ApiFaults {
  getMode(): ApiFaultMode;
  setMode(mode: ApiFaultMode): void;
  /** Calls the listener after every mode change, including 'fail-once' returning to normal. */
  subscribe(listener: () => void): () => void;
  /**
   * Runs before each request: waits as the mode says, then throws an `injected` ApiError if the request fails.
   * The outcome is decided when the request starts, so with 'fail-once' only the first of several requests fails.
   */
  beforeRequest(signal?: AbortSignal): Promise<void>;
}

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

/** setTimeout that rejects with the signal's reason when aborted, so a cancelled query stops waiting. */
export const sleep: Sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason);
    return;
  }
  const onAbort = () => {
    clearTimeout(timer);
    reject(signal!.reason);
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  signal?.addEventListener('abort', onAbort, { once: true });
});

export function createApiFaults(rules = MOCK_REQUEST_RULES, wait: Sleep = sleep): ApiFaults {
  let mode: ApiFaultMode = 'normal';
  const listeners = new Set<() => void>();
  const setMode = (next: ApiFaultMode) => {
    if (next === mode) return;
    mode = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    getMode: () => mode,
    setMode,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async beforeRequest(signal) {
      const waitMs = requestWaitMs(mode, rules);
      const { ok, nextMode } = settleRequest(mode);
      setMode(nextMode);
      if (waitMs > 0) await wait(waitMs, signal);
      if (!ok) throw new ApiError({ kind: 'injected', status: null, code: CLIENT_ERROR_CODES.injected });
    },
  };
}
