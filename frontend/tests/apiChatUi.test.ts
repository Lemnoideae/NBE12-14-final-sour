import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { ChatCallbacks, ChatConnectionFactory } from '../src/api/chatConnection';
import type { MyInfo } from '../src/api/users';
import { flush, message, page, success } from './helpers/chat';
import { assertAbsent } from './helpers/domAssert';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const { render, screen, fireEvent, cleanup, waitFor, act, within } = await import('@testing-library/react');
const { ApiProvider } = await import('../src/api/ApiProvider');
const { createApiClient } = await import('../src/api/client');
const { createQueryClient } = await import('../src/api/queryClient');
const { ApiError } = await import('../src/api/errors');
const { ApiChatBottomSheet } = await import('../src/components/ApiChatBottomSheet');
const clients: ReturnType<typeof createQueryClient>[] = [];
afterEach(async () => { cleanup(); await flush(); for (const client of clients.splice(0)) client.clear(); });
after(() => dom.window.close());
const ME: MyInfo = { id: 5, nickname: '우리학생', email: 'student@example.ac.kr', role: 'USER', status: 'ACTIVE', profileImageUrl: null,
  university: { id: 1, name: '한양대학교', logoUrl: null }, department: { id: 1, name: '공학과' },
  clicker: { level: 1, clickPower: 1, nextLevelRequiredScore: 10 }, totalContribScore: 0, totalAttackScore: 0 };

async function mount(options: { signedOut?: boolean; history?: (url: URL) => Response | Promise<Response>; words?: () => Response } = {}) {
  const calls: string[] = [], sends: string[] = [], callbacks: ChatCallbacks[] = [];
  let stopped = 0, login = 0;
  const api = createApiClient({ fetch: async (url) => {
    const parsed = new URL(String(url), 'http://localhost');
    calls.push(parsed.pathname + parsed.search);
    if (parsed.pathname === '/api/v1/users/me') return success(ME);
    if (parsed.pathname === '/api/v1/forbidden-words') return options.words?.() ?? success({ words: ['바보', 'badword'] });
    return options.history?.(parsed) ?? success(page([]));
  } });
  if (!options.signedOut) api.session.signIn('token');
  const query = createQueryClient();
  query.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
  clients.push(query);
  const factory: ChatConnectionFactory = (_api, _id, events) => {
    callbacks.push(events);
    return { send: (value) => { sends.push(value); return true; }, stop: () => { stopped++; } };
  };
  const ui = render(React.createElement(ApiProvider, { client: api, queryClient: query,
    children: React.createElement(ApiChatBottomSheet, { connectionFactory: factory, onGoToLogin: () => login++ }) }));
  if (!options.signedOut) {
    await waitFor(() => assert.equal(callbacks.length, 1));
    act(() => { callbacks[0].onStatus('connected'); callbacks[0].onReady(); });
    await waitFor(() => assert.equal((screen.getByLabelText('채팅 메시지') as HTMLTextAreaElement).disabled, false));
  }
  return { api, calls, sends, callbacks, ui, counts: () => ({ stopped, login }) };
}

test('로그인 전에는 REST/소켓을 열지 않고 로그인으로 안내한다', async () => {
  const f = await mount({ signedOut: true });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
  assert.equal(f.counts().login, 1);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.callbacks, []);
});

test('빈 학교 대화·서버 메시지만 표시하며 HTML과 금칙어 원문을 낙관적으로 렌더하지 않는다', async () => {
  const f = await mount();
  screen.getByText('아직 메시지가 없어요. 첫 대화를 시작해 보세요.');
  const input = screen.getByLabelText('채팅 메시지');
  fireEvent.change(input, { target: { value: 'badword' } });
  fireEvent.click(screen.getByRole('button', { name: '전송' }));
  assert.deepEqual(f.sends, ['badword']);
  assert.equal(screen.queryAllByTestId('chat-message').length, 0);
  act(() => f.callbacks[0].onMessage(message(1, { content: '** <script>문자열</script>' })));
  const bubble = screen.getByTestId('chat-message');
  assert.match(bubble.textContent ?? '', /\*\* <script>문자열<\/script>/);
  assertAbsent(bubble.querySelector('script'));
  assert.equal(screen.queryAllByText('badword').length, 0);
  f.ui.unmount();
  assert.equal(f.counts().stopped, 1);
});

test('한글 IME와 Safari229·Shift+Enter는 보내지 않고 일반 Enter와 버튼은 한 번씩만 보낸다', async () => {
  const f = await mount();
  const input = screen.getByLabelText('채팅 메시지') as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: '안녕하세요' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  assert.deepEqual(f.sends, []);
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
  assert.deepEqual(f.sends, ['안녕하세요']);
  assert.equal(input.value, '');
  fireEvent.change(input, { target: { value: '😀'.repeat(200) } });
  assert.equal(input.getAttribute('maxlength'), null);
  fireEvent.click(screen.getByRole('button', { name: '전송' }));
  assert.deepEqual(f.sends, ['안녕하세요', '😀'.repeat(200)]);
  fireEvent.change(input, { target: { value: '😀'.repeat(201) } });
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
  assert.equal(f.sends.length, 2);
  assert.equal(input.value, '😀'.repeat(201));
});

test('오류 큐는 메시지를 알리고 연결 중단은 전송을 막으며 연합 탭은 준비 중이다', async () => {
  const f = await mount();
  act(() => f.callbacks[0].onError(new ApiError({ kind: 'http', status: 429, code: 'CHAT_TOO_FREQUENT', serverMessage: '천천히 보내세요' })));
  assert.match(screen.getByRole('alert').textContent ?? '', /천천히 보내세요/);
  act(() => f.callbacks[0].onStatus('reconnecting'));
  assert.equal((screen.getByLabelText('채팅 메시지') as HTMLTextAreaElement).disabled, true);
  fireEvent.click(screen.getByRole('button', { name: '연합 채팅' }));
  screen.getByText('연합 채팅은 아직 준비 중이에요. 교내 채팅을 이용해 주세요.');
  assertAbsent(screen.queryByRole('textbox'));
  assert.deepEqual(f.sends, []);
});

test('공통 금칙어 목록의 로딩·오류·재시도·빈 목록과 복귀를 제공한다', async () => {
  let failure = true;
  const f = await mount({ words: () => failure ? new Response(JSON.stringify({ code: 'COMMON_INTERNAL_ERROR', message: '목록 실패' }), { status: 500 }) : success({ words: [] }) });
  fireEvent.click(screen.getByRole('button', { name: '금칙어' }));
  await screen.findByRole('heading', { name: '공통 금칙어 목록' });
  await waitFor(() => assert.match(screen.getByRole('alert').textContent ?? '', /목록 실패/));
  failure = false;
  fireEvent.click(screen.getByRole('button', { name: '금칙어 다시 불러오기' }));
  await screen.findByText('등록된 금칙어가 없어요.');
  fireEvent.click(screen.getByRole('button', { name: '채팅으로 돌아가기' }));
  assert.equal(document.activeElement?.textContent, '금칙어');
  assert.equal(f.callbacks.length, 1, '목록을 열어도 중복 소켓을 만들지 않는다');
  assert.ok(f.calls.includes('/api/v1/forbidden-words'));
});

test('과거 prepend와 동시 live append가 있어도 보고 있던 메시지의 위치를 지킨다', async (t) => {
  let finish!: (value: Response) => void;
  const f = await mount({ history: (url) => url.searchParams.has('cursor') ? new Promise((resolve) => { finish = resolve; })
    : success(page(Array.from({ length: 20 }, (_, i) => 40 - i), true)) });
  const viewport = screen.getByTestId('chat-history');
  Object.defineProperty(viewport, 'scrollHeight', { get: () => screen.getAllByTestId('chat-message').length * 100 });
  Object.defineProperty(viewport, 'clientHeight', { value: 200 });
  const rect = (top: number, height = 100) => ({ x: 0, y: top, width: 300, height, top, bottom: top + height, left: 0, right: 300, toJSON() {} });
  t.mock.method(dom.window.HTMLElement.prototype, 'getBoundingClientRect', function (this: HTMLElement) {
    if (this === viewport) return rect(0, 200);
    const nodes = [...viewport.querySelectorAll('[data-message-id]')];
    return rect(nodes.indexOf(this) * 100 - viewport.scrollTop);
  });
  viewport.scrollTop = 150;
  fireEvent.scroll(viewport);
  fireEvent.click(within(viewport).getByRole('button', { name: '이전 메시지 20개 불러오기' }));
  await act(async () => { await flush(); });
  act(() => f.callbacks[0].onMessage(message(41)));
  assert.equal(viewport.scrollTop, 150, '새 메시지가 와도 과거 읽기를 끌어내리지 않는다');
  await act(async () => { finish(success(page(Array.from({ length: 20 }, (_, i) => 20 - i)))); await flush(); });
  assert.equal(viewport.scrollTop, 2150, '기존 메시지22의 화면 내 위치를 보존한다');
  assert.equal(screen.getAllByTestId('chat-message').length, 41);
  assertAbsent(screen.queryByRole('button', { name: '이전 메시지 20개 불러오기' }));
  fireEvent.click(screen.getByRole('button', { name: '최신 메시지로' }));
  assert.equal(viewport.scrollTop, 4100);
});
