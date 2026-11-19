import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import { assertAbsent } from './helpers/domAssert';

// Login screen, logout and the session restore in API mode (SCRUM-152) against a fake backend. jsdom checks the flow;
// the cookie round trip across a reload is the browser check against the real backend.
const assetHooks = registerHooks({
  load(url, context, nextLoad) {
    if (/\.(jpg|png|webp|svg)(\?.*)?$/.test(url)) {
      const match = new URL(url).pathname.match(/\/src\/assets\/.+$/);
      return { format: 'module', source: `export default ${JSON.stringify(match ? match[0] : '/asset')};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
})) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });

const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react');
const { ApiProvider } = await import('../src/api/ApiProvider');
const { createApiClient } = await import('../src/api/client');
const { createApiFaults } = await import('../src/api/faults');
const { createQueryClient } = await import('../src/api/queryClient');
const { ApiLoginPhone, ApiSessionWatcher, ApiAccountNavLabel } = await import('../src/components/onboarding/ApiLoginPhone');

const queryClients: Array<ReturnType<typeof createQueryClient>> = [];
afterEach(() => {
  cleanup();
  for (const client of queryClients.splice(0)) {
    // MutationCache.clear() leaves each mutation's gc timer running (see apiSignup.test.ts).
    for (const mutation of client.getMutationCache().getAll()) mutation.destroy();
    client.clear();
  }
});
after(() => {
  dom.window.close();
  assetHooks.deregister();
});

const EMAIL = 'student@hanyang.ac.kr';
const PASSWORD = 'abcd123!';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ok = (data: unknown) => json(200, { code: 'SUCCESS', message: '요청이 성공했습니다.', data });
const fail = (status: number, code: string, message: string) => json(status, { code, message, data: null });
const REPLACED_MESSAGE = '다른 기기에서 로그인해 로그아웃되었습니다. 다시 로그인해주세요.';
const PROFILE = {
  id: 3, nickname: '새내기', email: EMAIL, role: 'USER', status: 'ACTIVE', profileImageUrl: null,
  university: { id: 8, name: '한양대학교', logoUrl: null }, department: { id: 7, name: '컴퓨터소프트웨어학부' },
  clicker: { level: 1, clickPower: 1, nextLevelRequiredScore: null }, totalContribScore: 0, totalAttackScore: 0,
};

type Handler = (body: Record<string, unknown>) => Response | Promise<Response>;

/** Renders the account screen, the root watcher and the nav label in StrictMode, the way the app mounts them. */
function mount({ restore = true, overrides = {} }: { restore?: boolean; overrides?: Record<string, Handler> } = {}) {
  let token = 0;
  const routes: Record<string, Handler> = {
    'POST /api/v1/auth/reissue': () => (restore
      ? ok({ accessToken: `restored-${++token}`, expiresInSeconds: 3600 })
      : fail(401, 'AUTH_INVALID_REFRESH_TOKEN', '로그인이 만료되었습니다. 다시 로그인해주세요.')),
    'POST /api/v1/auth/login': (body) => (body.password === PASSWORD
      ? ok({ accessToken: 'login-token', expiresInSeconds: 3600, user: { id: 3, nickname: '새내기', universityId: 8, role: 'USER' } })
      : fail(401, 'AUTH_INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.')),
    'POST /api/v1/auth/logout': () => new Response(null, { status: 204 }),
    // The account screen shows the nickname from the profile (SCRUM-153); apiMyInfo.test.ts covers the profile itself.
    'GET /api/v1/users/me': () => ok(PROFILE),
    ...overrides,
  };
  const calls: Array<{ route: string; authorization: string | null }> = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const route = `${init?.method ?? 'GET'} ${new URL(String(input), 'http://localhost').pathname}`;
    calls.push({ route, authorization: new Headers(init?.headers).get('Authorization') });
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
    const handler = routes[route];
    return handler ? handler(body) : fail(404, 'COMMON_NOT_FOUND', '없음');
  }) as typeof globalThis.fetch;
  const client = createApiClient({ fetch, faults: createApiFaults({ delayMs: 0, failDelayMs: 0 }) });
  const queryClient = createQueryClient();
  queryClients.push(queryClient);
  const events = { ended: 0, signup: 0, campus: 0 };
  render(React.createElement(React.StrictMode, null, React.createElement(ApiProvider, {
    client,
    queryClient,
    children: [
      React.createElement(ApiSessionWatcher, { key: 'watcher', onEnded: () => { events.ended += 1; } }),
      React.createElement('nav', { key: 'nav' }, React.createElement(ApiAccountNavLabel)),
      React.createElement(ApiLoginPhone, {
        key: 'login',
        onGoToSignup: () => { events.signup += 1; },
        onGoToCampus: () => { events.campus += 1; },
      }),
    ],
  })));
  return { client, calls, routes: () => calls.map((call) => call.route), events };
}

const navLabel = () => screen.getByRole('navigation').textContent;

async function logIn(password = PASSWORD) {
  await screen.findByRole('heading', { name: '로그인' });
  fireEvent.change(screen.getByLabelText('학교 이메일 주소'), { target: { value: ` ${EMAIL} ` } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: '로그인하기' }));
}

test('앱을 열면 refresh 쿠키로 세션을 복구한다. 컴포넌트가 여럿이고 StrictMode여도 reissue는 한 번이다', async () => {
  const { routes, events } = mount();
  assert.ok(screen.queryByText('로그인 상태를 확인하는 중…') !== null, '확인하는 동안 로그인 폼을 보이지 않는다');
  await screen.findByTestId('signed-in');
  await screen.findByRole('heading', { level: 2, name: '새내기님, 로그인되어 있어요' });
  assert.deepEqual(routes(), ['POST /api/v1/auth/reissue', 'GET /api/v1/users/me']);
  assert.equal(navLabel(), '🔑 내 계정 (로그인됨)');
  assert.equal(events.ended, 0);

  fireEvent.click(screen.getByRole('button', { name: '캠퍼스로 이동' }));
  assert.equal(events.campus, 1);
});

test('복구할 세션이 없으면 안내 없이 로그인 폼을 보이고, 틀린 비밀번호는 서버 문구로 알린다', async () => {
  const { calls, routes, events } = mount({ restore: false });
  await screen.findByRole('heading', { name: '로그인' });
  assertAbsent(screen.queryByRole('status'), '첫 방문에는 로그아웃 안내가 없다');
  assert.equal(navLabel(), '🔑 로그인');
  fireEvent.click(screen.getByRole('button', { name: /학교 이메일로 가입하기/ }));
  assert.equal(events.signup, 1);

  fireEvent.click(screen.getByRole('button', { name: '로그인하기' }));
  assert.equal((await screen.findByRole('alert')).textContent, '이메일과 비밀번호를 입력해 주세요.');
  assert.equal(routes().length, 1, '빈 입력은 보내지 않는다');

  await logIn('wrong-pass1!');
  assert.equal((await screen.findByRole('alert')).textContent, '이메일 또는 비밀번호가 올바르지 않습니다.');

  await logIn();
  assert.equal((await screen.findByTestId('signed-in')).querySelector('h2')?.textContent, '새내기님, 로그인되어 있어요');
  assert.deepEqual(calls.slice(1).map((call) => [call.route, call.authorization]), [
    ['POST /api/v1/auth/login', null],
    ['POST /api/v1/auth/login', null],
    ['GET /api/v1/users/me', 'Bearer login-token'],
  ]);
  assert.equal(navLabel(), '🔑 내 계정 (로그인됨)');
  assert.equal(events.ended, 0);
  assertAbsent(screen.queryByRole('button', { name: /학교 이메일로 가입하기/ }), '로그인된 뒤에는 가입 링크가 없다');
});

test('로그아웃: 토큰을 붙여 보내고 로그인 폼으로 돌아간다. 실패하면 로그인 상태를 남기고 알린다', async () => {
  let logoutCalls = 0;
  const { calls, events } = mount({
    overrides: {
      'POST /api/v1/auth/logout': () => (++logoutCalls === 1
        ? fail(500, 'COMMON_INTERNAL_ERROR', '서버 오류가 발생했습니다.')
        : new Response(null, { status: 204 })),
    },
  });
  await screen.findByTestId('signed-in');

  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
  assert.match((await screen.findByRole('alert')).textContent ?? '', /로그아웃하지 못했습니다/);
  assert.ok(screen.queryByTestId('signed-in') !== null);

  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
  await screen.findByRole('heading', { name: '로그인' });
  assertAbsent(screen.queryByRole('status'), '스스로 로그아웃하면 안내 문구가 없다');
  assert.deepEqual(calls.filter((call) => call.route.endsWith('/logout')).map((call) => call.authorization),
    ['Bearer restored-1', 'Bearer restored-1']);
  assert.equal(events.ended, 0, '스스로 로그아웃하면 강제 종료로 보지 않는다');
});

test('다른 기기 로그인으로 세션이 끝나면 앱에 알리고 로그인 화면에 이유를 보인다', async () => {
  const { client, events } = mount({
    // Any signed-in request may be the one that finds the session replaced; this path stands for it.
    overrides: { 'GET /api/v1/replaced-probe': () => fail(401, 'AUTH_SESSION_REPLACED', REPLACED_MESSAGE) },
  });
  await screen.findByTestId('signed-in');

  await act(async () => {
    await client.get('/replaced-probe').catch(() => undefined);
  });
  assert.equal((await screen.findByRole('status')).textContent, REPLACED_MESSAGE);
  assert.equal(events.ended, 1);

  // Typing re-renders everything; the app is told once, so it does not pull the user back to this screen.
  fireEvent.change(screen.getByLabelText('학교 이메일 주소'), { target: { value: EMAIL } });
  assert.equal(events.ended, 1);

  await logIn();
  await screen.findByTestId('signed-in');
  assert.equal(events.ended, 1);
});

test('세션을 확인하지 못하면(연결 실패) 이유를 보이고 로그인 폼은 그대로 쓸 수 있다', async () => {
  const { routes } = mount({ overrides: { 'POST /api/v1/auth/reissue': () => { throw new TypeError('Failed to fetch'); } } });
  assert.equal((await screen.findByText(/로그인 상태를 확인하지 못했습니다/)).textContent,
    '로그인 상태를 확인하지 못했습니다. 서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.');
  assert.deepEqual(routes(), ['POST /api/v1/auth/reissue'], '응답이 사라졌을 수 있으니 다시 보내지 않는다 (refresh 토큰은 한 번만 쓴다)');
  await logIn();
  await screen.findByTestId('signed-in');
});

test('로그아웃 요청이 세션 교체로 실패하면 로그인 화면에 교체 이유만 보인다', async () => {
  const { events } = mount({ overrides: { 'POST /api/v1/auth/logout': () => fail(401, 'AUTH_SESSION_REPLACED', REPLACED_MESSAGE) } });
  await screen.findByTestId('signed-in');
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
  assert.equal((await screen.findByRole('status')).textContent, REPLACED_MESSAGE);
  assertAbsent(screen.queryByRole('alert'), '로그아웃 실패 문구를 함께 띄우지 않는다');
  assert.equal(events.ended, 1);
});
