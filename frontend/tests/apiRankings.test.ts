// SCRUM-161: ranking pages from the API, joined by scrolling, with the viewer's own row and no rank-change badge.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { MyInfo } from '../src/api/users';
import type { DepartmentRankingPage, UniversityRankingPage, UserRankingPage } from '../src/api/rankings';
import { installDialogStub } from './helpers/dialogStub';
import { assertAbsent } from './helpers/domAssert';

const assets = registerHooks({ load(url, context, nextLoad) {
  if (/\.(jpg|png|webp|svg)(\?.*)?$/.test(url)) return { format: 'module', source: 'export default "/asset";', shortCircuit: true };
  return nextLoad(url, context);
} });
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
installDialogStub(dom.window);
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
})) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });

const { render, screen, act, cleanup, waitFor, fireEvent } = await import('@testing-library/react');
const { ApiProvider } = await import('../src/api/ApiProvider');
const { createApiClient } = await import('../src/api/client');
const { createQueryClient } = await import('../src/api/queryClient');
const { userKeys } = await import('../src/api/users');
const { RANKING_PAGE_SIZE } = await import('../src/api/rankings');
const { MockGameProvider } = await import('../src/hooks/useMockGame');
const { useApiRankingBoard, toApiRows, toApiMine } = await import('../src/hooks/useRankingBoard');
const { RankingStatusNotice, SIGNED_OUT_RANKING_NOTICE, rankingCaption } = await import('../src/components/RankingParts');
const { RankingScreenPhone } = await import('../src/components/RankingScreenPhone');
const clients: Array<ReturnType<typeof createQueryClient>> = [];
afterEach(() => { cleanup(); for (const client of clients.splice(0)) client.clear(); });
after(() => { assets.deregister(); dom.window.close(); });

const ME: MyInfo = {
  id: 10, nickname: '순위학생', email: 'rank@hanyang.ac.kr', role: 'USER', status: 'ACTIVE', profileImageUrl: null,
  university: { id: 1, name: '한양대학교', logoUrl: null }, department: { id: 7, name: '컴퓨터소프트웨어학부' },
  clicker: { level: 1, clickPower: 1, nextLevelRequiredScore: 10 }, totalContribScore: 30, totalAttackScore: 0,
};
const school = (rank: number, universityId: number, name: string, totalScore: number) => ({ rank, universityId, name, logoUrl: null, totalScore });
const SCHOOL_PAGES: UniversityRankingPage[] = [
  { items: [school(1, 4, '서버1등대', 900), school(2, 9, '서버2등대', 800), school(2, 12, '공동2등대', 800)], page: 0, size: RANKING_PAGE_SIZE,
    totalCount: 5, hasNext: true, myUniversity: { rank: 5, universityId: 1, totalScore: 100 } },
  { items: [school(4, 30, '서버4등대', 300), school(5, 1, '한양대학교', 100)], page: 1, size: RANKING_PAGE_SIZE,
    totalCount: 5, hasNext: false, myUniversity: { rank: 5, universityId: 1, totalScore: 100 } },
];
const DEPT_PAGE: DepartmentRankingPage = {
  items: [{ rank: 1, departmentId: 7, name: '컴퓨터소프트웨어학부', logoUrl: null, totalScore: 50 }, { rank: 2, departmentId: 8, name: '서버학과', logoUrl: null, totalScore: 20 }],
  page: 0, size: RANKING_PAGE_SIZE, totalCount: 2, hasNext: false, myDepartment: { rank: 1, departmentId: 7, totalScore: 50 },
};
const USER_PAGE: UserRankingPage = {
  items: [{ rank: 1, userId: 99, nickname: '다른학생', profileImageUrl: null, department: { id: 8, name: '서버학과' }, contribScore: 70 }],
  page: 0, size: RANKING_PAGE_SIZE, totalCount: 2, hasNext: true, me: { rank: 2, contribScore: 30 },
};
const ok = (data: unknown) => new Response(JSON.stringify({ code: 'SUCCESS', message: '성공', data }), { status: 200 });
const fail = (status: number, code: string, message: string) => new Response(JSON.stringify({ code, message, data: null }), { status });

let board: ReturnType<typeof useApiRankingBoard>;
function Probe({ tab }: { tab: 'school' | 'dept' | 'personal' }) {
  board = useApiRankingBoard(tab, 0);
  return React.createElement(React.Fragment, null,
    React.createElement(RankingStatusNotice, { board }),
    React.createElement('ol', { 'aria-label': '순위' }, board.rows.map((row) => React.createElement('li', { key: row.key }, `${row.rank} ${row.name}${row.isMine ? ' (내 소속)' : ''}`))),
    board.mine && React.createElement('output', { 'aria-label': '내 순위' }, `${board.mine.rank} ${board.mine.name} ${board.mine.score}`),
  );
}
interface Call { path: string; auth: string | null }
function mount(tab: 'school' | 'dept' | 'personal', { signedIn = true, respond }: { signedIn?: boolean; respond?: (url: URL) => Response | undefined } = {}) {
  const calls: Call[] = [];
  const client = createApiClient({ fetch: (async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    calls.push({ path: `${url.pathname}${url.search}`, auth: new Headers(init?.headers).get('Authorization') });
    const custom = respond?.(url);
    if (custom) return custom;
    const page = Number(url.searchParams.get('page'));
    if (url.pathname.endsWith('/rankings/universities')) return ok(SCHOOL_PAGES[page]);
    if (url.pathname.endsWith('/rankings/universities/1/departments')) return ok(DEPT_PAGE);
    if (url.pathname.endsWith('/rankings/universities/1/users')) return ok(USER_PAGE);
    if (url.pathname.endsWith('/users/me')) return ok(ME);
    if (url.pathname.endsWith('/auth/reissue')) return fail(401, 'AUTH_INVALID_REFRESH_TOKEN', '다시 로그인해 주세요.');
    throw new Error(`Unexpected path: ${url.pathname}`);
  }) as typeof fetch });
  const queryClient = createQueryClient(); clients.push(queryClient);
  if (signedIn) { client.session.signIn('member-a'); queryClient.setQueryData(userKeys.me, ME); }
  render(React.createElement(ApiProvider, { client, queryClient, children: React.createElement(Probe, { tab }) }));
  return { calls, rankingCalls: () => calls.filter((call) => call.path.includes('/rankings/')) };
}
const listed = () => screen.getAllByRole('listitem').map((item) => item.textContent);

test('학교 순위는 20개 페이지를 스크롤로 이어 붙이고, 내 학교는 그 페이지 전에도 고정 행으로 보인다', async () => {
  const f = mount('school');
  await waitFor(() => assert.equal(board.status, 'ready'));
  // Ties share the server's rank; my school's page is not loaded yet, so its row comes from myUniversity.
  assert.deepEqual(listed(), ['1 서버1등대', '2 서버2등대', '2 공동2등대']);
  assert.equal(screen.getByRole('status', { name: '내 순위' }).textContent, '5 한양대학교 100');
  assert.equal(board.hasMore, true);
  assert.deepEqual(f.rankingCalls(), [{ path: `/api/v1/rankings/universities?page=0&size=${RANKING_PAGE_SIZE}`, auth: 'Bearer member-a' }]);

  await act(async () => { board.loadMore(); board.loadMore(); });
  await waitFor(() => assert.equal(board.rows.length, 5));
  assert.deepEqual(listed().slice(3), ['4 서버4등대', '5 한양대학교 (내 소속)']);
  assert.equal(board.hasMore, false);
  // The second loadMore while the first was in flight sent nothing.
  assert.deepEqual(f.rankingCalls().map((call) => call.path), [
    `/api/v1/rankings/universities?page=0&size=${RANKING_PAGE_SIZE}`, `/api/v1/rankings/universities?page=1&size=${RANKING_PAGE_SIZE}`]);
  assert.ok(board.rows.every((row) => row.change === null), 'API 행에는 순위 변동이 없다 (D-3)');
});

test('학과·개인 순위는 내 학교 ID로 조회하고 내 학과·본인 순위를 표시한다', async () => {
  const dept = mount('dept');
  await waitFor(() => assert.equal(board.status, 'ready'));
  assert.deepEqual(listed(), ['1 컴퓨터소프트웨어학부 (내 소속)', '2 서버학과']);
  assert.equal(screen.getByRole('status', { name: '내 순위' }).textContent, '1 컴퓨터소프트웨어학부 50');
  assert.match(dept.rankingCalls()[0].path, /^\/api\/v1\/rankings\/universities\/1\/departments\?page=0/);
  cleanup();

  const personal = mount('personal');
  await waitFor(() => assert.equal(board.status, 'ready'));
  assert.deepEqual(listed(), ['1 다른학생']);
  // Not on the loaded page: built from `me` and the profile.
  assert.equal(screen.getByRole('status', { name: '내 순위' }).textContent, '2 순위학생 30');
  assert.equal(board.mine?.subtitle, '한양대학교 · 컴퓨터소프트웨어학부');
  assert.match(personal.rankingCalls()[0].path, /^\/api\/v1\/rankings\/universities\/1\/users\?page=0/);
});

test('로그인 전에는 학교 순위만 익명으로 조회하고 학과·개인 탭은 안내만 보인다', async () => {
  const guest = mount('school', { signedIn: false });
  await waitFor(() => assert.equal(board.status, 'ready'));
  assert.equal(guest.rankingCalls()[0].auth, null);
  assertAbsent(screen.queryByRole('status', { name: '내 순위' }));
  assert.ok(board.rows.every((row) => !row.isMine));
  cleanup();

  const scoped = mount('personal', { signedIn: false });
  assert.equal(board.status, 'signed-out');
  assert.ok(screen.getByText(SIGNED_OUT_RANKING_NOTICE));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(scoped.rankingCalls(), []);
});

test('조회 실패는 서버 문구로 안내하고 다시 시도하면 목록을 보인다', async () => {
  let broken = true;
  const f = mount('school', { respond: (url) => (broken && url.pathname.endsWith('/rankings/universities')
    ? fail(400, 'COMMON_INVALID_INPUT', '잘못된 순위 요청입니다.') : undefined) });
  await waitFor(() => assert.equal(board.status, 'failed'));
  assert.ok(screen.getByText('잘못된 순위 요청입니다.'));
  broken = false;
  fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }));
  await waitFor(() => assert.equal(board.status, 'ready'));
  assert.equal(listed()[0], '1 서버1등대');
  assert.equal(f.rankingCalls().length, 2);
});

test('다시 조회로 순위가 페이지 경계를 넘어가도 같은 행은 한 번만 보인다', () => {
  // A refetch moved 공동2등대 from page 0 to the top of page 1.
  const moved: UniversityRankingPage[] = [
    { ...SCHOOL_PAGES[0], items: SCHOOL_PAGES[0].items.slice(0, 2).concat(school(3, 30, '서버4등대', 850)) },
    { ...SCHOOL_PAGES[1], items: [school(3, 30, '서버4등대', 850), school(4, 12, '공동2등대', 800)] },
  ];
  const rows = toApiRows('school', moved, ME);
  assert.deepEqual(rows.map((row) => row.key), ['school:4', 'school:9', 'school:30', 'school:12']);
  assert.equal(toApiMine('school', moved, rows, undefined), null, '로그인 전에는 내 행이 없다');
  assert.equal(toApiMine('personal', [{ ...USER_PAGE, me: null }], [], ME), null, '비공개 회원은 서버가 me를 비운다');
});

test('목업 모드 순위 화면은 기존 표본 문구와 10개 단위 더보기를 유지한다', async () => {
  render(React.createElement(MockGameProvider, null, React.createElement(RankingScreenPhone, { currentSchoolScore: 0, onNavigateTab: () => undefined })));
  assert.ok(screen.getByText(/전국 학교 · 목업 샘플/));
  assert.ok(screen.getByText('15 / 76개교'));
  fireEvent.click(screen.getByRole('button', { name: /아래로 스크롤하여 10개교 더 보기/ }));
  assert.ok(screen.getByText(/순위 데이터를 더 불러오는 중… \(15 \/ 76\)/));
  await waitFor(() => assert.ok(screen.getByText('25 / 76개교')), { timeout: 2000 });
  fireEvent.click(screen.getByRole('button', { name: '교내 학과' }));
  assertAbsent(screen.queryByRole('button', { name: /아래로 스크롤하여 더 보기/ }));
  assert.deepEqual(rankingCaption('dept', { isSample: false }, '한양대'), ['한양대 교내 학과', '점수 내림차순 · 동점은 같은 순위']);
});

test('Java 계약 센서: 순위 DTO 필드와 경로가 바뀌면 api/rankings.ts와 useRankingBoard를 재검토한다', () => {
  const root = new URL('../../src/main/java/com/back/nbe1214finalsour/domain/university/', import.meta.url);
  const records = (file: string) => Object.fromEntries([...readFileSync(new URL(`dto/${file}.java`, root), 'utf8')
    .matchAll(/record (\w+)\(([^)]*)\)/g)].map(([, name, body]) => [name, body.split(',').map((part) => part.trim().split(/\s+/).at(-1))]));
  const fix = 'api/rankings.ts의 DTO 타입과 useRankingBoard의 행 변환을 Java 계약과 맞추세요';
  const page = ['items', 'page', 'size', 'totalCount', 'hasNext'];
  const university = records('UniversityRankingResponse');
  assert.deepEqual(university.UniversityRankingResponse, Object.keys(SCHOOL_PAGES[0]), fix);
  assert.deepEqual(university.Item, Object.keys(SCHOOL_PAGES[0].items[0]), fix);
  assert.deepEqual(university.MyUniversity, Object.keys(SCHOOL_PAGES[0].myUniversity!), fix);
  const department = records('DepartmentRankingResponse');
  assert.deepEqual(department.DepartmentRankingResponse, [...page, 'myDepartment'], fix);
  assert.deepEqual(department.Item, Object.keys(DEPT_PAGE.items[0]), fix);
  assert.deepEqual(department.MyDepartment, Object.keys(DEPT_PAGE.myDepartment!), fix);
  const user = records('UserRankingResponse');
  assert.deepEqual(user.UserRankingResponse, [...page, 'me'], fix);
  assert.deepEqual(user.Item, Object.keys(USER_PAGE.items[0]), fix);
  assert.deepEqual(user.DepartmentInfo, ['id', 'name'], fix);
  assert.deepEqual(user.Me, Object.keys(USER_PAGE.me!), fix);
  const controller = readFileSync(new URL('controller/RankingController.java', root), 'utf8');
  assert.match(controller, /@RequestMapping\("\/api\/v1\/rankings"\)/, fix);
  for (const path of ['/universities', '/universities/{universityId}/departments', '/universities/{universityId}/users']) {
    assert.ok(controller.includes(`@GetMapping("${path}")`), `${fix}: ${path}`);
  }
  assert.match(controller, /defaultValue = "20"\) @Min\(1\) @Max\(100\) int size/, fix);
});

test('연결 센서: 두 순위 화면은 목업 순위를 직접 읽지 않고 useRankingBoard를 쓴다', () => {
  for (const file of ['RankingScreenPhone.tsx', 'RankingsView.tsx']) {
    const source = readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
    assert.match(source, /useRankingBoard\(/, `${file}: 순위 데이터는 useRankingBoard에서 받으세요`);
    assert.doesNotMatch(source, /getMockRankings/, `${file}: 목업 순위는 useRankingBoard의 목업 구현만 읽습니다`);
  }
});
