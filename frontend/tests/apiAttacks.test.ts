// SCRUM-168: real API-mode visit component + root-lifetime attack queue, with deterministic backend responses.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import { SCHOOL_ID, type SchoolId } from '../src/data/schoolIds';
import type { MyInfo } from '../src/api/users';
import type { UniversityDetail } from '../src/api/universities';
import type { AttackRequest, AttackResponse } from '../src/api/attacks';
import { installDialogStub } from './helpers/dialogStub';
import { assertAbsent } from './helpers/domAssert';

// Vite normally supplies import.meta.env; select API mode explicitly in this isolated Node worker.
const assets = registerHooks({ load(url, context, nextLoad) {
  if (/\/api\/mode\.ts$/.test(url)) return { format: 'module', source: 'export const API_MODE = "api"; export function selectByMode(impl) { return impl.api; }', shortCircuit: true };
  if (/\.(jpg|png|webp|svg)(\?.*)?$/.test(url)) return { format: 'module', source: 'export default "/asset";', shortCircuit: true };
  return nextLoad(url, context);
} });
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
installDialogStub(dom.window);
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
})) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, screen, cleanup, waitFor, fireEvent, act } = await import('@testing-library/react');
const { ApiProvider } = await import('../src/api/ApiProvider');
const { createApiClient } = await import('../src/api/client');
const { createQueryClient } = await import('../src/api/queryClient');
const { userKeys } = await import('../src/api/users');
const { universityKeys } = await import('../src/api/universities');
const { MockGameProvider } = await import('../src/hooks/useMockGame');
const { useApiCampusAttacks } = await import('../src/hooks/useCampusAttacks');
const { VisitingScreen1Phone } = await import('../src/components/VisitingScreen1Phone');
const { AttackNotice } = await import('../src/components/VisitAttackBar');
const { soundManager } = await import('../src/utils/sound');
soundManager.enabled = false;
const clients: Array<ReturnType<typeof createQueryClient>> = [];
afterEach(() => { cleanup(); for (const client of clients.splice(0)) client.clear(); });
after(() => { assets.deregister(); dom.window.close(); });

const ME: MyInfo = {
  id: 10, nickname: '공격학생', email: 'attack@hanyang.ac.kr', role: 'USER', status: 'ACTIVE', profileImageUrl: null,
  university: { id: SCHOOL_ID.hanyang, name: '한양대학교', logoUrl: null }, department: { id: 7, name: '국악과' },
  clicker: { level: 1, clickPower: 10, nextLevelRequiredScore: 100 }, totalContribScore: 100, totalAttackScore: 0,
};
const DETAIL: UniversityDetail = { id: SCHOOL_ID.pusan, name: '부산대학교', logoUrl: null, totalScore: 1000, rank: 2, memberCount: 42,
  topDepartments: [], topContributors: [], isMyUniversity: false };
const ANSWER: AttackResponse = { acceptedClicks: 4, damage: 12, multiplier: 1, isRival: false,
  targetUniversity: { id: DETAIL.id, name: DETAIL.name, totalScore: 988, rank: 3 }, myAttackScore: 12 };
const ok = (data: unknown) => new Response(JSON.stringify({ code: 'SUCCESS', message: '성공', data }), { status: 200 });
const fail = (status: number, code: string) => new Response(JSON.stringify({ code, message: code, data: null }), { status });
let attacks: ReturnType<typeof useApiCampusAttacks>;
function mount({ signedIn = true, respond, busy = false, beforeRead }: {
  signedIn?: boolean; busy?: boolean; respond?: (body: AttackRequest, n: number) => Response | Promise<Response>;
  beforeRead?: (path: string) => Response | Promise<Response> | undefined;
} = {}) {
  const calls: Array<{ body: AttackRequest; auth: string | null }> = [];
  let locked = false;
  let unlocks = 0;
  const begin = () => {
    if (busy || locked) return null;
    locked = true;
    return () => { locked = false; unlocks += 1; };
  };
  const client = createApiClient({ fetch: (async (input, init) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    if (path.endsWith('/attacks')) {
      const body = JSON.parse(String(init?.body)) as AttackRequest;
      calls.push({ body, auth: new Headers(init?.headers).get('Authorization') });
      return respond ? respond(body, calls.length) : ok(ANSWER);
    }
    const custom = beforeRead?.(path);
    if (custom) return custom;
    if (path.endsWith('/users/me')) return ok(ME);
    if (/\/universities\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1));
      return ok({ ...DETAIL, id, isMyUniversity: signedIn && id === ME.university.id });
    }
    throw new Error(`Unexpected path: ${path}`);
  }) as typeof fetch });
  const queryClient = createQueryClient(); clients.push(queryClient);
  if (signedIn) { client.session.signIn('member-a'); queryClient.setQueryData(userKeys.me, ME); }
  function Root({ targetId, visible }: { targetId: SchoolId; visible: boolean }) {
    attacks = useApiCampusAttacks(begin);
    return React.createElement(React.Fragment, null,
      React.createElement(AttackNotice, { attacks }),
      visible ? React.createElement(VisitingScreen1Phone, { schoolId: targetId, attacks }) : null);
  }
  const tree = (targetId: SchoolId, visible: boolean) => React.createElement(MockGameProvider, null,
    React.createElement(ApiProvider, { client, queryClient, children: React.createElement(Root, { targetId, visible }) }));
  const view = render(tree(SCHOOL_ID.pusan, true));
  return { calls, client, queryClient, locked: () => locked, unlocks: () => unlocks,
    navigate: (id: SchoolId, visible = true) => view.rerender(tree(id, visible)), setBusy: (value: boolean) => { busy = value; } };
}
const attackButton = () => screen.getByRole('button', { name: /캠퍼스 공격/ });
const settle = () => waitFor(() => assert.match(screen.getByTestId('attack-result').textContent ?? '', /피해/), { timeout: 2500 });

test('캠퍼스 클릭은 1초 배치·대상 ID·Bearer를 보내고, 확정 점수와 순위를 HUD·정보 시트에 반영한다', async () => {
  const f = mount();
  await waitFor(() => assert.ok(attackButton()));
  const button = attackButton();
  assert.equal(button.tagName, 'BUTTON', '키보드 기본 동작을 가진 native button');
  for (let i = 0; i < 4; i++) fireEvent.click(button);
  assert.equal(f.calls.length, 0, '클릭마다 요청하지 않는다');
  assert.equal(f.locked(), true, '내 학교 클릭·강화·구매 큐를 잠근다');
  assert.equal(screen.getByTestId('visit-score').textContent, '1,000점', '서버 응답 전 피해를 추측하지 않는다');
  await settle();
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0], { auth: 'Bearer member-a', body: { submissionId: f.calls[0].body.submissionId, clickCount: 4, targetUniversityId: SCHOOL_ID.pusan } });
  assert.ok(f.calls[0].body.submissionId);
  assert.match(screen.getByTestId('attack-result').textContent ?? '', /일반 공격 ×1.0 · 4회 · 피해 12/);
  assert.equal(screen.getByTestId('visit-score').textContent, '988점');
  assert.equal(screen.getByTestId('visit-rank').textContent, '3위');
  assert.deepEqual(f.queryClient.getQueryData<MyInfo>(userKeys.me), { ...ME, totalAttackScore: 12 }, '기여도·클리커·프로필은 보존');
  assert.equal(f.locked(), false);
  fireEvent.click(screen.getByTestId('visit-info-button'));
  assert.match(screen.getByTestId('visit-info-score').textContent ?? '', /988/);
  assert.equal(f.calls.length, 1, '정보 버튼은 공격으로 전파되지 않는다');
});

test('20회 넘는 공격은 같은 대상으로 20/5로 직렬 전송하고 서로 다른 제출 ID를 쓴다', async () => {
  const f = mount({ respond: (body) => ok({ ...ANSWER, acceptedClicks: body.clickCount }) });
  await waitFor(() => assert.ok(attackButton()));
  for (let i = 0; i < 25; i++) fireEvent.click(attackButton());
  await waitFor(() => assert.equal(attacks.pendingClicks, 0), { timeout: 3500 });
  assert.deepEqual(f.calls.map(({ body }) => body.clickCount), [20, 5]);
  assert.ok(f.calls.every(({ body }) => body.targetUniversityId === SCHOOL_ID.pusan));
  assert.notEqual(f.calls[0].body.submissionId, f.calls[1].body.submissionId);
  assert.equal(f.unlocks(), 1, '전체 큐가 빈 뒤에만 잠금을 푼다');
});

test('공격 전에 시작한 학교·내 정보 조회의 늦은 응답이 확정 점수를 되돌리지 않는다', async () => {
  let blockReads = false;
  const replies: Array<() => void> = [];
  const f = mount({ beforeRead: (path) => blockReads
    ? new Promise<Response>((resolve) => replies.push(() => resolve(ok(path.endsWith('/users/me') ? ME : DETAIL))))
    : undefined });
  await waitFor(() => assert.ok(attackButton()));
  blockReads = true;
  let reads!: Promise<unknown>;
  act(() => {
    reads = Promise.all([
      f.queryClient.refetchQueries({ queryKey: universityKeys.detail(SCHOOL_ID.pusan, ME.id), exact: true }),
      f.queryClient.refetchQueries({ queryKey: userKeys.me, exact: true }),
    ]);
  });
  await waitFor(() => assert.equal(replies.length, 2));
  for (let i = 0; i < 4; i++) fireEvent.click(attackButton());
  await settle();
  await act(async () => { for (const reply of replies) reply(); await reads; });
  assert.equal(screen.getByTestId('visit-score').textContent, '988점');
  assert.equal(f.queryClient.getQueryData<MyInfo>(userKeys.me)?.totalAttackScore, 12);
});

test('라이벌 ×1.1과 실제 0 피해도 서버 응답 그대로 표시한다', async () => {
  mount({ respond: () => ok({ ...ANSWER, damage: 0, isRival: true, multiplier: 1.1, targetUniversity: { ...ANSWER.targetUniversity, totalScore: 0 } }) });
  await waitFor(() => assert.ok(attackButton()));
  fireEvent.click(attackButton());
  await settle();
  assert.match(screen.getByTestId('attack-result').textContent ?? '', /라이벌 공격 ×1.1.*피해 0/);
  assert.equal(screen.getByTestId('visit-score').textContent, '0점');
});

test('로그인 전에는 관전만, 자기 학교에는 공격 요청을 보내지 않는다', async () => {
  const guest = mount({ signedIn: false });
  await waitFor(() => assert.ok(screen.getByTestId('spectator-bar')));
  assertAbsent(screen.queryByRole('button', { name: /캠퍼스 공격/ }));
  act(() => { assert.equal(attacks.tap(SCHOOL_ID.pusan), false); });
  assert.equal(guest.calls.length, 0);
  cleanup();
  const self = mount();
  await waitFor(() => assert.ok(attackButton()));
  act(() => { assert.equal(attacks.tap(SCHOOL_ID.hanyang), false); });
  self.navigate(SCHOOL_ID.hanyang);
  await waitFor(() => assertAbsent(screen.queryByRole('button', { name: /캠퍼스 공격/ })));
  assert.equal(self.calls.length, 0);
});

test('내 학교 작업이 대기 중이면 공격을 모으지 않고 잠금 해제 뒤에만 받는다', async () => {
  const f = mount({ busy: true });
  await waitFor(() => assert.ok(attackButton()));
  fireEvent.click(attackButton());
  assert.equal(attacks.pendingClicks, 0);
  assert.match(screen.getByTestId('attack-notice').textContent ?? '', /내 학교 클릭/);
  f.setBusy(false);
  fireEvent.click(attackButton());
  await settle();
  assert.equal(f.calls.length, 1);
});

test('화면을 떠나도 원래 학교에 보내고, 미확정 공격이 있는 동안 새 학교로 대상을 바꾸지 않는다', async () => {
  const f = mount();
  await waitFor(() => assert.ok(attackButton()));
  fireEvent.click(attackButton());
  f.navigate(SCHOOL_ID.snu);
  await waitFor(() => assert.equal((attackButton() as HTMLButtonElement).disabled, true));
  act(() => { assert.equal(attacks.tap(SCHOOL_ID.snu), false); });
  f.navigate(SCHOOL_ID.snu, false);
  await waitFor(() => assert.equal(attacks.result?.damage, 12), { timeout: 2500 });
  assert.equal(f.calls[0].body.targetUniversityId, SCHOOL_ID.pusan);
  const cached = f.queryClient.getQueryData<UniversityDetail>(universityKeys.detail(SCHOOL_ID.pusan, ME.id));
  assert.equal(cached?.totalScore, 988);
  assert.equal(f.unlocks(), 1);
});

test('세션 종료는 전송 전 큐와 늦은 응답을 폐기하고 잠금을 푼다', async () => {
  const before = mount();
  await waitFor(() => assert.ok(attackButton()));
  fireEvent.click(attackButton());
  act(() => before.client.session.signOut());
  assert.equal(before.locked(), false);
  await act(() => new Promise((resolve) => setTimeout(resolve, 1100)));
  assert.equal(before.calls.length, 0);
  cleanup();
  let resolve!: (response: Response) => void;
  const late = mount({ respond: () => new Promise<Response>((done) => { resolve = done; }) });
  await waitFor(() => assert.ok(attackButton()));
  fireEvent.click(attackButton());
  await waitFor(() => assert.equal(late.calls.length, 1), { timeout: 2500 });
  act(() => late.client.session.signOut());
  await act(async () => { resolve(ok(ANSWER)); });
  assert.equal(attacks.result, null);
  assert.equal(late.queryClient.getQueryData<MyInfo>(userKeys.me)?.totalAttackScore, 0);
  assert.equal(late.locked(), false);
});

test('HTTP 전송 전 지연 중 계정이 바뀌어도 이전 공격을 새 토큰으로 보내지 않는다', async () => {
  const f = mount();
  await waitFor(() => assert.ok(attackButton()));
  f.client.faults.setMode('delay');
  fireEvent.click(attackButton());
  // The 1s batch timer has fired, but the client's 1.5s injected delay has not finished.
  await act(() => new Promise((resolve) => setTimeout(resolve, 1100)));
  assert.equal(f.calls.length, 0);
  act(() => {
    f.client.session.signOut();
    f.client.session.signIn('member-b');
    f.queryClient.setQueryData(userKeys.me, { ...ME, id: 11 });
  });
  await act(() => new Promise((resolve) => setTimeout(resolve, 1600)));
  assert.equal(f.calls.length, 0, '이전 회원의 공격은 새 회원의 Bearer로 전송되면 안 된다');
  assert.equal(f.locked(), false);
});

test('429는 자동 재전송하지 않고 명시적으로 거절 배치만 제외한다', async () => {
  const f = mount({ respond: () => fail(429, 'CLICK_TOO_FREQUENT') });
  await waitFor(() => assert.ok(attackButton()));
  fireEvent.click(attackButton());
  await waitFor(() => assert.equal(attacks.blocked, true), { timeout: 2500 });
  assert.equal(f.calls.length, 1);
  assert.equal(screen.getByTestId('visit-score').textContent, '1,000점');
  assert.equal((attackButton() as HTMLButtonElement).disabled, true);
  fireEvent.click(screen.getByRole('button', { name: '거절된 배치를 제외하고 공격 재개' }));
  assert.equal(attacks.pendingClicks, 0);
  assert.equal(f.locked(), false);
});

test('봇 확인 완료 뒤 같은 제출 ID와 대상으로 재개한다', async () => {
  const f = mount({ respond: (_body, n) => n === 1 ? fail(403, 'ABUSE_VERIFICATION_REQUIRED') : ok(ANSWER) });
  await waitFor(() => assert.ok(attackButton()));
  fireEvent.click(attackButton());
  await waitFor(() => assert.ok(attacks.botCheck?.open), { timeout: 2500 });
  assert.equal(f.calls.length, 1);
  // ApiBotCheckDialog has its own server-verification tests; only its successful callback resumes this queue.
  act(() => attacks.botCheck!.onVerified());
  await settle();
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[0].body, f.calls[1].body);
});

test('응답 유실 뒤 중복 제출 409는 새 ID로 다시 공격하지 않고 보류한다', async () => {
  const f = mount({ respond: (_body, n) => { if (n === 1) throw new TypeError('response lost'); return fail(409, 'CLICK_DUPLICATE_SUBMISSION'); } });
  await waitFor(() => assert.ok(attackButton()));
  fireEvent.click(attackButton());
  await waitFor(() => assert.equal(attacks.blocked, true), { timeout: 3500 });
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[0].body, f.calls[1].body);
  assert.equal(attacks.retryLimited, null);
  assert.match(screen.getByTestId('attack-notice').textContent ?? '', /미확정 공격 1회/);
  assert.equal(screen.getByTestId('visit-score').textContent, '1,000점');
});

test('계약 센서: 공격 경로·필드·자기 학교 거절·공유 한도·응답 배율은 백엔드와 일치한다', () => {
  const root = new URL('../../src/main/java/com/back/nbe1214finalsour/domain/click/', import.meta.url);
  const request = readFileSync(new URL('dto/AttackRequest.java', root), 'utf8');
  for (const field of ['submissionId', 'clickCount', 'targetUniversityId']) assert.match(request, new RegExp(`\\b${field}\\b`));
  assert.match(request, /@Max\(value = 20/);
  const response = readFileSync(new URL('dto/AttackResponse.java', root), 'utf8');
  for (const field of ['acceptedClicks', 'damage', 'multiplier', 'isRival', 'targetUniversity', 'myAttackScore']) assert.match(response, new RegExp(`\\b${field}\\b`));
  assert.match(response, /isRival \? 1\.1 : 1\.0/);
  const controller = readFileSync(new URL('controller/AttackController.java', root), 'utf8');
  assert.match(controller, /@RequestMapping\("\/api\/v1\/attacks"\)/);
  const service = readFileSync(new URL('service/AttackService.java', root), 'utf8');
  assert.match(service, /ATTACK_OWN_UNIVERSITY/);
  assert.match(service, /clickActionGuard.verifyAndGetBaseScore/);
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /useCampusAttacks\(campusClicks.beginUpgrade\)/);
  assert.match(app, /attacks=\{campusAttacks\}/);
});
