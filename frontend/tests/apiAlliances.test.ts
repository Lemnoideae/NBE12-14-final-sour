// SCRUM-177: create an alliance and show its detail in API mode. The server has no "my alliance" query yet, so the
// screen remembers the created alliance per member in this browser and finds others by ID.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';

const assets = registerHooks({ load(url, context, nextLoad) {
  if (/\.(jpg|png|webp|svg)(\?.*)?$/.test(url)) return { format: 'module', source: 'export default "/asset";', shortCircuit: true };
  return nextLoad(url, context);
} });
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
})) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });

const { render, screen, fireEvent, cleanup, waitFor, within } = await import('@testing-library/react');
const { ApiProvider } = await import('../src/api/ApiProvider');
const { createApiClient } = await import('../src/api/client');
const { createQueryClient } = await import('../src/api/queryClient');
const { createAllianceMemory, parseAllianceId, validateAllianceName } = await import('../src/api/alliances');
const { ApiAllianceScreenPhone, remainingTime } = await import('../src/components/ApiAllianceScreenPhone');
const { SCHOOL_ID } = await import('../src/data/schoolIds');
const { assertAbsent, assertSameNode } = await import('./helpers/domAssert');
type MyInfo = import('../src/api/users').MyInfo;
type Alliance = import('../src/api/alliances').Alliance;

const queryClients: Array<ReturnType<typeof createQueryClient>> = [];
afterEach(() => {
  cleanup();
  for (const client of queryClients.splice(0)) {
    // MutationCache.clear() keeps each mutation's 5-minute gc timer alive, so node would not exit; destroy() cancels it.
    for (const mutation of client.getMutationCache().getAll()) mutation.destroy();
    client.clear();
  }
});
after(() => { assets.deregister(); dom.window.close(); });

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ok = (data: unknown, status = 200) => json(status, { code: 'SUCCESS', message: '요청이 성공했습니다.', data });
const fail = (status: number, code: string, message = '서버 연합 오류', data: unknown = null) => json(status, { code, message, data });

const ME: MyInfo = {
  id: 5, nickname: '연합장', email: 'leader@hanyang.ac.kr', role: 'USER', status: 'ACTIVE', profileImageUrl: null,
  university: { id: SCHOOL_ID.hanyang, name: '한양대학교', logoUrl: null }, department: { id: 11, name: '컴퓨터소프트웨어학부' },
  clicker: { level: 1, clickPower: 1, nextLevelRequiredScore: 10 }, totalContribScore: 0, totalAttackScore: 0,
};
/** 2026-11-19 12:00 KST. */
const NOW = Date.parse('2026-11-19T03:00:00Z');
const alliance = (id: number, overrides: Partial<Alliance> = {}): Alliance => ({
  id, name: `연합 ${id}`, totalScore: 1234, status: 'ACTIVE', durationHours: 24, expiredAt: '2026-11-20T12:00:00+09:00', ...overrides,
});

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    storage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } },
  };
}

interface Call { route: string; body: unknown }
function mount({ create, detail, signedIn = true, store = fakeStorage(), memory }: {
  create?: (body: unknown) => Response; detail?: (id: number) => Response; signedIn?: boolean;
  store?: ReturnType<typeof fakeStorage>; memory?: ReturnType<typeof createAllianceMemory>;
} = {}) {
  const calls: Call[] = [];
  const created = new Map<number, Alliance>();
  const client = createApiClient({ fetch: (async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    const call = { route: `${init?.method ?? 'GET'} ${url.pathname}`, body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    if (call.route === 'GET /api/v1/users/me') return ok(ME);
    if (call.route === 'POST /api/v1/alliances') {
      if (create) return create(call.body);
      const body = call.body as { name: string; durationHours: number };
      const made = alliance(7, { name: body.name, durationHours: body.durationHours, totalScore: 0 });
      created.set(made.id, made);
      return ok(made, 201);
    }
    const found = /^GET \/api\/v1\/alliances\/(\d+)$/.exec(call.route);
    if (found) return detail ? detail(Number(found[1])) : ok(created.get(Number(found[1])) ?? alliance(Number(found[1])));
    throw new Error(`Unexpected ${call.route}`);
  }) as typeof fetch });
  if (signedIn) client.session.signIn('access-1');
  const queryClient = createQueryClient();
  queryClients.push(queryClient);
  const navigation: string[] = [];
  render(React.createElement(ApiProvider, { client, queryClient, children: React.createElement(ApiAllianceScreenPhone, {
    onBack: () => navigation.push('back'), onGoToLogin: () => navigation.push('login'),
    memory: memory ?? createAllianceMemory(() => store.storage), now: () => NOW,
  }) }));
  const posts = () => calls.filter(({ route }) => route === 'POST /api/v1/alliances').map(({ body }) => body);
  const details = () => calls.filter(({ route }) => route.startsWith('GET /api/v1/alliances/')).map(({ route }) => route.slice('GET /api/v1/alliances/'.length));
  return { calls, posts, details, store, navigation };
}

const createForm = () => screen.getByRole('form', { name: '연합 만들기' });
const fillName = (value: string) => fireEvent.change(within(createForm()).getByLabelText('연합 이름'), { target: { value } });
const submitCreate = () => fireEvent.click(within(createForm()).getByRole('button', { name: '연합 만들기' }));
const field = (detail: HTMLElement, term: string) => {
  const terms = [...detail.querySelectorAll('dt')];
  return terms.find((dt) => dt.textContent === term)?.nextElementSibling?.textContent;
};

test('연합을 만들면 다듬은 이름과 기간을 보내고, 만든 연합의 상세를 보이며 이 회원의 연합으로 기억한다', async () => {
  const f = mount();
  await screen.findByRole('form', { name: '연합 만들기' });
  screen.getByText(/한양대학교이\(가\) 창립 학교가 되는 연합/);
  fillName('  한양 연합  ');
  screen.getByText('5/50자 · 앞뒤 공백은 빼고 저장돼요');
  fireEvent.click(within(screen.getByRole('group', { name: '연합 유지 기간' })).getByRole('button', { name: '48h' }));
  screen.getByText('만들면 48시간 (2일) 뒤에 만료돼요.');
  submitCreate();

  const detail = await screen.findByTestId('alliance-detail');
  assert.deepEqual(f.posts(), [{ name: '한양 연합', durationHours: 48 }]);
  await waitFor(() => assert.equal(within(detail).getByRole('heading', { level: 3 }).textContent, '한양 연합'));
  assert.equal(screen.getByTestId('alliance-status').textContent, '활동 중');
  assert.equal(field(detail, '연합 ID'), '#7');
  assert.equal(field(detail, '유지 기간'), '48시간 (2일)');
  assert.match(field(detail, '만료 시각') ?? '', /2026.*11.*20.*\(KST\)$/);
  assert.equal(field(detail, '남은 시간'), '만료까지 24시간 0분');
  screen.getByText('연합을 만들었어요.');
  assert.equal(f.store.data.get('sour.alliance.created.v1:5'), '7');
  assertAbsent(screen.queryByRole('form', { name: '연합 만들기' }), '소속된 뒤에는 만들기 폼을 숨긴다');
  screen.getByText(/연합 목록, 소속 학교, 가입 신청과 승인, 대결은 서버 조회 기능이 생기면 열려요/);
});

test('기억한 연합이 있으면 다시 들어왔을 때 서버에서 그 연합을 조회해 보인다', async () => {
  const f = mount({ store: fakeStorage({ 'sour.alliance.created.v1:5': '12' }), detail: (id) => ok(alliance(id, { status: 'IN_MATCH', totalScore: 98765 })) });
  const detail = await screen.findByTestId('alliance-detail');
  await waitFor(() => assert.equal(field(detail, '총점'), '98,765점'));
  assert.equal(screen.getByTestId('alliance-status').textContent, '대결 중');
  assert.deepEqual(f.details(), ['12']);
  fireEvent.click(within(detail).getByRole('button', { name: '새로고침' }));
  await waitFor(() => assert.deepEqual(f.details(), ['12', '12']));
});

test('우리 학교가 이미 연합에 소속돼 있으면(409) 중복 소속을 알리고 ID로 찾기로 안내한다', async () => {
  const f = mount({ create: () => fail(409, 'ALLY_UNIVERSITY_ALREADY_JOINED', '이미 연합에 소속된 학교입니다.') });
  await screen.findByRole('form', { name: '연합 만들기' });
  fillName('두 번째 연합');
  submitCreate();
  const error = await screen.findByTestId('alliance-create-error');
  assert.equal(error.getAttribute('role'), 'alert');
  assert.match(error.textContent ?? '', /^우리 학교는 이미 연합에 소속돼 있어요\.한 학교는 연합 하나에만 소속될 수 있어요/);
  assert.equal(f.store.data.size, 0, '실패한 생성은 기억하지 않는다');
  fireEvent.click(within(error).getByRole('button', { name: '연합 ID로 찾기' }));
  assertSameNode(document.activeElement, screen.getByLabelText('연합 ID'), '찾기 입력으로 초점을 옮긴다');
  assert.equal((within(createForm()).getByLabelText('연합 이름') as HTMLInputElement).value, '두 번째 연합', '입력은 그대로 둔다');
});

test('활동 중이 아닌 회원(403), 입력 오류(400)는 각각 알리고, 다시 누르면 다시 보낸다', async () => {
  let reply = () => fail(403, 'ALLY_USER_NOT_ACTIVE', '활성 회원만 연합을 생성할 수 있습니다.');
  const f = mount({ create: () => reply() });
  await screen.findByRole('form', { name: '연합 만들기' });
  fillName('연합');
  submitCreate();
  await waitFor(() => assert.match(screen.getByTestId('alliance-create-error').textContent ?? '', /^활동 중인 회원만 연합을 만들 수 있어요\./));
  reply = () => fail(400, 'COMMON_INVALID_INPUT', '입력값이 올바르지 않습니다.', [{ field: 'name', reason: '서버 이름 규칙' }]);
  submitCreate();
  await waitFor(() => assert.equal(screen.getByTestId('alliance-create-error').textContent, '연합을 만들지 못했어요. 서버 이름 규칙'));
  assert.equal(within(createForm()).getByLabelText('연합 이름').getAttribute('aria-invalid'), 'true');
  reply = () => { throw new TypeError('network down'); };
  submitCreate();
  await waitFor(() => assert.match(screen.getByTestId('alliance-create-error').textContent ?? '', /응답을 받지 못했다면 같은 학교 연합이 이미 생겼을 수 있어요/));
  assert.equal(f.posts().length, 3, '자동 재시도 없이 누를 때마다 한 번');
});

test('이름이 비었거나 50자를 넘으면 보내지 않는다. 앞뒤 공백을 뺀 50자는 보낸다', async () => {
  const f = mount();
  await screen.findByRole('form', { name: '연합 만들기' });
  const input = within(createForm()).getByLabelText('연합 이름');
  for (const [value, message] of [['   ', '연합 이름을 입력해 주세요.'], ['가'.repeat(51), '연합 이름은 50자 이하로 입력해 주세요.']]) {
    fillName(value);
    submitCreate();
    assert.equal(screen.getByRole('alert').textContent, message);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
  }
  assert.deepEqual(f.posts(), []);
  fillName(`  ${'가'.repeat(50)}  `);
  assert.equal(input.getAttribute('aria-invalid'), 'false', '고치면 오류 표시를 지운다');
  submitCreate();
  await screen.findByTestId('alliance-detail');
  assert.deepEqual(f.posts(), [{ name: '가'.repeat(50), durationHours: 24 }]);
});

test('기억한 연합이 서버에 없으면(404) 기억을 지우고 만들기 폼으로 돌아간다. 만료된 연합은 잊고 새로 만들 수 있다', async () => {
  const gone = mount({ store: fakeStorage({ 'sour.alliance.created.v1:5': '3' }), detail: () => fail(404, 'ALLY_NOT_FOUND', '연합을 찾을 수 없습니다.') });
  await screen.findByText('기억해 둔 연합 #3을(를) 찾을 수 없어 목록에서 지웠어요.');
  assert.equal(gone.store.data.size, 0);
  screen.getByRole('form', { name: '연합 만들기' });
  cleanup();

  const expired = mount({ store: fakeStorage({ 'sour.alliance.created.v1:5': '4' }), detail: (id) => ok(alliance(id, { status: 'EXPIRED' })) });
  const detail = await screen.findByTestId('alliance-detail');
  await waitFor(() => assert.equal(field(detail, '남은 시간'), '만료됨'));
  within(detail).getByText('만료된 연합이에요. 이 연합을 잊으면 새 연합을 만들 수 있어요.');
  fireEvent.click(within(detail).getByRole('button', { name: '이 연합 잊기' }));
  screen.getByRole('form', { name: '연합 만들기' });
  assert.equal(expired.store.data.size, 0);
});

test('연합 ID로 찾으면 그 연합을 보이고 기억하지는 않는다. 잘못된 ID는 보내지 않는다', async () => {
  const f = mount({ detail: (id) => id === 404 ? fail(404, 'ALLY_NOT_FOUND', '연합을 찾을 수 없습니다.') : ok(alliance(id)) });
  await screen.findByRole('form', { name: '연합 만들기' });
  const lookup = screen.getByRole('form', { name: '연합 ID로 찾기' });
  const input = within(lookup).getByLabelText('연합 ID');
  fireEvent.change(input, { target: { value: '0' } });
  fireEvent.click(within(lookup).getByRole('button', { name: '찾기' }));
  assert.equal(within(lookup).getByRole('alert').textContent, '연합 ID는 1 이상의 정수로 입력해 주세요.');
  fireEvent.change(input, { target: { value: '9' } });
  fireEvent.click(within(lookup).getByRole('button', { name: '찾기' }));
  const detail = await screen.findByRole('article', { name: '연합 #9' });
  await waitFor(() => assert.equal(within(detail).getByRole('heading', { level: 3 }).textContent, '연합 9'));
  assertAbsent(within(detail).queryByRole('button', { name: '이 연합 잊기' }), '찾아본 연합은 내 연합이 아니다');
  assert.equal(f.store.data.size, 0);
  fireEvent.change(input, { target: { value: '404' } });
  fireEvent.click(within(lookup).getByRole('button', { name: '찾기' }));
  await screen.findByText('연합 #404을(를) 찾을 수 없어요.');
  screen.getByRole('form', { name: '연합 만들기' });
});

test('브라우저 저장소를 쓸 수 없어도 만든 연합을 보인다', async () => {
  const broken = createAllianceMemory(() => ({
    getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); },
  }));
  mount({ memory: broken });
  await screen.findByRole('form', { name: '연합 만들기' });
  fillName('저장소 없는 연합');
  submitCreate();
  const detail = await screen.findByTestId('alliance-detail');
  await waitFor(() => assert.equal(field(detail, '연합 ID'), '#7'));
  fireEvent.click(within(detail).getByRole('button', { name: '이 연합 잊기' }));
  screen.getByRole('form', { name: '연합 만들기' });
});

test('로그인하지 않았으면 로그인 안내만 보이고 서버를 부르지 않는다', async () => {
  const f = mount({ signedIn: false });
  fireEvent.click(await screen.findByRole('button', { name: '로그인' }));
  assert.deepEqual(f.navigation, ['login']);
  assert.deepEqual(f.calls, []);
  fireEvent.click(screen.getByRole('button', { name: '이전 화면으로 돌아가기' }));
  assert.deepEqual(f.navigation, ['login', 'back']);
});

test('입력 검사와 남은 시간 계산', () => {
  assert.deepEqual(validateAllianceName(' a '), { name: 'a' });
  assert.deepEqual(parseAllianceId(' 12 '), { allianceId: 12 });
  for (const value of ['', '-1', '1.5', '1e3', '9007199254740993']) assert.ok('problem' in parseAllianceId(value), value);
  assert.equal(remainingTime('2026-11-19T12:30:00+09:00', NOW), '만료까지 0시간 30분');
  assert.equal(remainingTime('2026-11-19T11:00:00+09:00', NOW), '만료 시각이 지났어요');
});

test('계약 센서: 연합 생성·상세 계약이 바뀌면 화면을 다시 확인한다', () => {
  const main = new URL('../../src/main/java/com/back/nbe1214finalsour/', import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, main), 'utf8');
  const fix = 'src/api/alliances.ts와 ApiAllianceScreenPhone을 백엔드 계약에 맞춰 고친 뒤 이 센서를 갱신하세요.';
  const controller = read('domain/alliance/controller/AllianceController.java');
  assert.match(controller, /@RequestMapping\("\/api\/v1\/alliances"\)/, fix);
  assert.match(controller, /@GetMapping\("\/\{allianceId\}"\)/, fix);
  assert.match(controller, /@PostMapping\s*\n\s*@ResponseStatus\(HttpStatus\.CREATED\)\s*\n\s*public ApiResponse<AllianceResponse> createAlliance/, fix);
  assert.match(read('domain/alliance/dto/AllianceCreateRequest.java'),
    /@NotBlank @Size\(max = 50\) String name,\s*@NotNull @Min\(6\) @Max\(72\) Integer durationHours/, fix);
  assert.match(read('domain/alliance/dto/AllianceResponse.java'),
    /Long id,\s*String name,\s*Long totalScore,\s*AllianceStatus status,\s*Integer durationHours,\s*OffsetDateTime expiredAt/, fix);
  assert.match(read('domain/alliance/entity/AllianceStatus.java'), /ACTIVE,[\s\S]*IN_MATCH,[\s\S]*EXPIRED\s*\n\s*\}/, fix);
  assert.match(read('domain/alliance/entity/Alliance.java'), /name\.trim\(\)\.length\(\) > 50/, fix);
  const errors = read('global/exception/ErrorCode.java');
  assert.match(errors, /ALLY_UNIVERSITY_ALREADY_JOINED\(HttpStatus\.CONFLICT, "ALLY_UNIVERSITY_ALREADY_JOINED"/, fix);
  assert.match(errors, /ALLY_USER_NOT_ACTIVE\(HttpStatus\.FORBIDDEN, "ALLY_USER_NOT_ACTIVE"/, fix);
  assert.match(errors, /ALLY_NOT_FOUND\(HttpStatus\.NOT_FOUND, "ALLY_NOT_FOUND"/, fix);
  assert.doesNotMatch(controller, /@GetMapping\("\/me"\)|@GetMapping\s*\n\s*public ApiResponse<.*List/,
    '연합 조회 API(내 연합·목록)가 생겼습니다. "준비 중" 안내와 브라우저 기억(AllianceMemory)을 서버 조회로 바꾸세요.');

  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const apiRoute = app.indexOf("API_MODE === 'api' && (viewMode === 'alliance_apply' || viewMode === 'current_alliance') ?");
  assert.ok(apiRoute >= 0 && apiRoute < app.indexOf("viewMode === 'alliance_apply' ? ("),
    'API 모드의 연합 화면은 ApiAllianceScreenPhone이다. 목업 제안 화면([시연] 버튼·가상 시계)은 목업 모드 전용이다.');
});
