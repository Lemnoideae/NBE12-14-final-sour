import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import { assertAbsent } from './helpers/domAssert';
import type { ClickRequest, ClickResponse } from '../src/api/clicks';
import type { MyInfo } from '../src/api/users';

const assets = registerHooks({
  load(url, context, nextLoad) {
    if (/\.(jpg|png|webp|svg)(\?.*)?$/.test(url)) {
      return { format: 'module', source: 'export default "/asset";', shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
})) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });

const { render, screen, fireEvent, cleanup, act, waitFor } = await import('@testing-library/react');
const { ApiProvider } = await import('../src/api/ApiProvider');
const { createApiClient } = await import('../src/api/client');
const { createQueryClient } = await import('../src/api/queryClient');
const { userKeys } = await import('../src/api/users');
const { MockGameProvider, useMockGame } = await import('../src/hooks/useMockGame');
const { useApiCampusClicks, useCampusClicks } = await import('../src/hooks/useCampusClicks');
const { ApiPlayerSync } = await import('../src/components/ApiPlayerSync');
const { ApiSessionWatcher } = await import('../src/components/onboarding/ApiLoginPhone');
const clients: Array<ReturnType<typeof createQueryClient>> = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) {
    for (const mutation of client.getMutationCache().getAll()) mutation.destroy();
    client.clear();
  }
});
after(() => { dom.window.close(); assets.deregister(); });

const ME: MyInfo = {
  id: 10, nickname: '배치학생', email: 'test@hanyang.ac.kr', role: 'USER', status: 'ACTIVE', profileImageUrl: null,
  university: { id: 1, name: '한양대학교', logoUrl: null }, department: { id: 7, name: '컴퓨터소프트웨어학부' },
  clicker: { level: 1, clickPower: 2, nextLevelRequiredScore: 100 }, totalContribScore: 10, totalAttackScore: 0,
};
const RESPONSE: ClickResponse = {
  acceptedClicks: 2, earnedScore: 4, multiplier: 1, myContribScore: 14,
  university: { id: 1, totalScore: 104, rank: 1, logoUrl: 'tempUrl' },
  department: { id: 7, totalScore: 24 }, schoolClicksLastSecond: 2,
};
const ok = (data: unknown) => new Response(JSON.stringify({ code: 'SUCCESS', message: '성공', data }), { status: 200 });
const fail = (status: number, code: string) => new Response(JSON.stringify({ code, message: '전송 오류', data: null }), { status });
const readGame = () => JSON.parse(screen.getByTestId('game').textContent ?? '{}') as { contribution: number; schoolScore: number; departmentScore: number };

function Probe() {
  const clicks = useApiCampusClicks();
  const game = useMockGame();
  const [onCampus, setOnCampus] = React.useState(true);
  return React.createElement(React.Fragment, null,
    React.createElement(ApiPlayerSync, { getPendingScore: clicks.getPendingScore }),
    React.createElement('output', { 'data-testid': 'game' }, JSON.stringify(game.state)),
    clicks.notice && React.createElement('p', { role: 'alert' }, clicks.notice),
    onCampus && React.createElement('button', { onClick: () => clicks.tap(false) }, '클릭'),
    React.createElement('button', { onClick: () => clicks.tap(true) }, '치명타'),
    React.createElement('button', { onClick: () => setOnCampus((value) => !value) }, '탭 전환'),
  );
}

function mount(send: (request: ClickRequest) => Promise<Response> = async () => ok(RESPONSE), signedIn = true) {
  const sent: ClickRequest[] = [];
  const tokens: Array<string | null> = [];
  const client = createApiClient({ fetch: (async (input, init) => {
    const path = String(input);
    if (path.endsWith('/users/me')) return ok(ME);
    if (path.endsWith('/clicks')) {
      const body = JSON.parse(String(init?.body)) as ClickRequest;
      sent.push(body);
      tokens.push(new Headers(init?.headers).get('Authorization'));
      return send(body);
    }
    if (path.endsWith('/auth/reissue')) return signedIn
      ? ok({ accessToken: 'member-a', expiresInSeconds: 3600 })
      : fail(401, 'AUTH_INVALID_REFRESH_TOKEN');
    throw new Error(`Unexpected request: ${path}`);
  }) as typeof fetch });
  if (signedIn) client.session.signIn('member-a');
  const queryClient = createQueryClient();
  clients.push(queryClient);
  render(React.createElement(React.StrictMode, null, React.createElement(ApiProvider, {
    client, queryClient, children: React.createElement(MockGameProvider, {
      children: [React.createElement(ApiSessionWatcher, { key: 'watcher', onEnded: () => undefined }), React.createElement(Probe, { key: 'probe' })],
    }),
  })));
  return { client, queryClient, sent, tokens };
}
const ready = async () => waitFor(() => assert.equal(readGame().contribution, 10));
const click = () => fireEvent.click(screen.getByRole('button', { name: '클릭' }));

test('API 탭은 실제 clickPower로 낙관 반영한 뒤 세 점수를 응답으로 보정하고 프로필 캐시도 갱신한다', async () => {
  const { sent, tokens, queryClient } = mount();
  await ready();
  click(); click();
  assert.equal(readGame().contribution, 14);
  assert.equal(sent.length, 0);
  const pending = new dom.window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(pending);
  assert.equal(pending.defaultPrevented, true);
  await waitFor(() => assert.equal(readGame().schoolScore, 104), { timeout: 2500 });
  assert.deepEqual(readGame(), { contribution: 14, clickerId: 1, schoolScore: 104, departmentScore: 24, activeBuff: null });
  assert.equal(queryClient.getQueryData<MyInfo>(userKeys.me)?.totalContribScore, 14);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].clickCount, 2);
  assert.deepEqual(tokens, ['Bearer member-a']);
  const settled = new dom.window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(settled);
  assert.equal(settled.defaultPrevented, false);
  assertAbsent(screen.queryByRole('alert'));
});

test('느린 응답 중 새 클릭·내 정보 재조회·탭 이동에도 미확정 점수를 보존한다', async () => {
  let resolve!: (response: Response) => void;
  let calls = 0;
  const { sent, queryClient } = mount(async () => ++calls === 1 ? new Promise((done) => { resolve = done; }) : ok({
    ...RESPONSE, myContribScore: 16, university: { ...RESPONSE.university, totalScore: 106 }, department: { id: 7, totalScore: 26 },
  }));
  await ready();
  click(); click();
  await waitFor(() => assert.equal(sent.length, 1), { timeout: 2500 });
  click();
  assert.equal(readGame().contribution, 16);
  await act(async () => {
    queryClient.setQueryData<MyInfo>(userKeys.me, { ...ME, nickname: '변경닉네임' });
  });
  assert.equal(readGame().contribution, 16, '프로필 변경도 미확정 3회 점수를 지우지 않는다');
  fireEvent.click(screen.getByRole('button', { name: '탭 전환' }));
  assertAbsent(screen.queryByRole('button', { name: '클릭' }));
  await act(async () => { resolve(ok(RESPONSE)); });
  assert.equal(readGame().contribution, 16);
  assert.equal(readGame().schoolScore, 106);
  assert.equal(readGame().departmentScore, 26);
  await waitFor(() => assert.equal(sent.length, 2), { timeout: 2500 });
  assert.equal(sent[1].clickCount, 1);
  await waitFor(() => assert.equal(queryClient.getQueryData<MyInfo>(userKeys.me)?.totalContribScore, 16));
  assert.equal(readGame().contribution, 16);
});

for (const [status, code] of [[429, 'CLICK_COUNT_EXCEEDED'], [403, 'ABUSE_VERIFICATION_REQUIRED']] as const) {
  test(`${status}: 오류·미확정 수·새로고침 손실을 알리고 추가 클릭을 막는다`, async () => {
    const { sent } = mount(async () => fail(status, code));
    await ready();
    click();
    await screen.findByRole('alert', {}, { timeout: 2500 });
    assert.match(screen.getByRole('alert').textContent ?? '', /미확정 1회 전송을 보류/);
    assert.match(screen.getByRole('alert').textContent ?? '', /새로고침하면 미확정 클릭은 사라지며/);
    assert.equal(readGame().contribution, 12);
    click();
    assert.equal(readGame().contribution, 12);
    assert.equal(sent.length, 1);
  });
}

test('미로그인 상태는 점수를 적립하지 않고 클릭 API도 보내지 않는다', async () => {
  const { sent } = mount(undefined, false);
  const initial = readGame().contribution;
  click();
  assert.equal(readGame().contribution, initial);
  assert.equal(sent.length, 0);
  assert.match(screen.getByRole('alert').textContent ?? '', /로그인해 주세요/);
});

test('세션 종료는 미전송 배치를 취소하고 다음 계정으로 재전송하지 않으며 취소 수를 알린다', async () => {
  const { client, sent, tokens, queryClient } = mount();
  await ready();
  click();
  await act(async () => { client.session.signOut(); });
  assert.match(screen.getByRole('alert').textContent ?? '', /세션 종료로 미확정 1회/);
  await act(async () => {
    client.session.signIn('member-b');
    queryClient.setQueryData<MyInfo>(userKeys.me, { ...ME, id: 11, totalContribScore: 100 });
  });
  await waitFor(() => assert.equal(readGame().contribution, 100));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });
  assert.equal(sent.length, 0);
  click();
  await waitFor(() => assert.equal(sent.length, 1), { timeout: 2500 });
  assert.deepEqual(tokens, ['Bearer member-b']);
  assert.equal(sent[0].clickCount, 1);
});

test('같은 프레임에 같은 계정으로 재로그인해도 이전 큐를 폐기하고 새 큐를 만든다', async () => {
  const { client, sent } = mount();
  await ready();
  click();
  await act(async () => {
    client.session.signOut();
    client.session.signIn('member-a-new-session');
  });
  click();
  await waitFor(() => assert.equal(sent.length, 1), { timeout: 2500 });
  assert.equal(sent[0].clickCount, 1, '이전 세션의 미확정 클릭을 새 세션에 보내지 않는다');
});

test('API 모드에서는 목업의 치명타 배율을 요청 데이터나 점수에 섞지 않는다', async () => {
  const { sent } = mount();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '치명타' }));
  assert.equal(readGame().contribution, 12);
  await waitFor(() => assert.equal(sent.length, 1), { timeout: 2500 });
  assert.deepEqual(Object.keys(sent[0]), ['submissionId', 'clickCount']);
});

test('기본 목업 어댑터는 기존 tap을 그대로 쓰며 ApiProvider가 없어도 동작한다', () => {
  function MockProbe() {
    const clicks = useCampusClicks();
    const game = useMockGame();
    return React.createElement('button', { onClick: () => clicks.tap(false) }, String(game.state.contribution));
  }
  render(React.createElement(MockGameProvider, { children: React.createElement(MockProbe) }));
  const initial = Number(screen.getByRole('button').textContent);
  fireEvent.click(screen.getByRole('button'));
  assert.ok(Number(screen.getByRole('button').textContent) > initial);
});
