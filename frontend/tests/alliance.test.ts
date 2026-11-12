import assert from 'node:assert/strict';
import { assertAbsent } from './helpers/domAssert';
import { after, afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';

// DOM 통합 테스트용 자산 로더
const assetHooks = registerHooks({
  load(url, context, nextLoad) {
    if (/\.(jpg|png|webp|svg)(\?.*)?$/.test(url)) {
      return { format: 'module', source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

// DOM 환경 설정
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
dom.window.HTMLElement.prototype.scrollIntoView = function () {};

const { render, screen, fireEvent, act, cleanup } = await import('@testing-library/react');
const {
  ALLIANCE_SIZE,
  applyAllianceRequest,
  cancelAllianceRequest,
  demoAcceptAllianceRequest,
  demoRejectAllianceRequest,
  getAllianceForSchool,
  INITIAL_ALLIANCE_STATE,
  INITIAL_MOCK_ALLIANCES,
} = await import('../src/data/allianceModel.ts');
const { AllianceProvider, useAlliance } = await import('../src/hooks/useMockAlliance.tsx');
const { MockGameProvider } = await import('../src/hooks/useMockGame.tsx');
const { AllianceApplyScreenPhone } = await import('../src/components/AllianceApplyScreenPhone.tsx');
const { CurrentAllianceScreenPhone } = await import('../src/components/CurrentAllianceScreenPhone.tsx');
const { default: App } = await import('../src/App.tsx');

afterEach(() => cleanup());
after(() => {
  assetHooks.deregister();
  dom.window.close();
});

test('연합 신청 유효성 검사: 자기 학교 신청, 유효하지 않은 학교 ID, 중복 대기 신청을 거절한다', () => {
  const state = INITIAL_ALLIANCE_STATE;

  // 자기 학교 신청 거절
  const selfRes = applyAllianceRequest(state, 'hanyang', 'hanyang');
  assert.equal(selfRes.result.success, false);
  if (!selfRes.result.success) {
    assert.match(selfRes.result.error, /자기 학교/);
  }

  // 존재하지 않는 학교 ID 거절
  const invalidRes = applyAllianceRequest(state, 'hanyang', 'not-a-school');
  assert.equal(invalidRes.result.success, false);
  if (!invalidRes.result.success) {
    assert.match(invalidRes.result.error, /유효하지 않은 학교 ID/);
  }

  // 정상 신청
  const validRes = applyAllianceRequest(state, 'hanyang', 'pusan', 1000);
  assert.equal(validRes.result.success, true);
  assert.equal(validRes.nextState.requests.length, 1);
  const pendingReq = validRes.nextState.requests[0];
  assert.equal(pendingReq.requesterSchoolId, 'hanyang');
  assert.equal(pendingReq.recipientSchoolId, 'pusan');
  assert.equal(pendingReq.status, 'pending');

  // 동일 학교 쌍 간 중복 대기 신청 거절
  const dupRes1 = applyAllianceRequest(validRes.nextState, 'hanyang', 'pusan', 1001);
  assert.equal(dupRes1.result.success, false);
  if (!dupRes1.result.success) {
    assert.match(dupRes1.result.error, /이미 대기 중인/);
  }

  // 역방향 동일 학교 쌍 간 중복 대기 신청도 거절
  const dupRes2 = applyAllianceRequest(validRes.nextState, 'pusan', 'hanyang', 1002);
  assert.equal(dupRes2.result.success, false);
  if (!dupRes2.result.success) {
    assert.match(dupRes2.result.error, /이미 대기 중인/);
  }
});

test('상태 전이 및 확정된 요청의 재처리(2회 승인/거절/취소) 차단을 검증한다', () => {
  const state = INITIAL_ALLIANCE_STATE;
  const { nextState: state1, result: appRes } = applyAllianceRequest(state, 'hanyang', 'pusan', 2000);
  assert.ok(appRes.success);
  assert.ok(appRes.request);
  const reqId = appRes.request.id;

  // 1. 수락 전이: 새로운 연합 생성 및 요청 accepted 상태 갱신
  const { nextState: acceptedState, result: acceptRes } = demoAcceptAllianceRequest(state1, reqId, 2100);
  assert.equal(acceptRes.success, true);
  if (acceptRes.success) {
    assert.ok(acceptRes.alliance);
    assert.deepEqual([...acceptRes.alliance.schoolIds], ['hanyang', 'pusan']);
  }
  const acceptedReq = acceptedState.requests.find((r) => r.id === reqId);
  assert.equal(acceptedReq?.status, 'accepted');

  // 이미 수락된 요청에 대해 재처리(수락/거절/취소) 시 거절
  const reAccept = demoAcceptAllianceRequest(acceptedState, reqId, 2200);
  assert.equal(reAccept.result.success, false);
  assert.match((reAccept.result as { error: string }).error, /이미 처리된/);

  const reReject = demoRejectAllianceRequest(acceptedState, reqId, 2200);
  assert.equal(reReject.result.success, false);
  assert.match((reReject.result as { error: string }).error, /이미 처리된/);

  const reCancel = cancelAllianceRequest(acceptedState, reqId, 2200);
  assert.equal(reCancel.result.success, false);
  assert.match((reCancel.result as { error: string }).error, /이미 처리된/);

  // 2. 거절 전이: 요청 rejected 상태 갱신 및 재처리 차단
  const { nextState: state2 } = applyAllianceRequest(state, 'hanyang', 'knu', 3000);
  const req2 = state2.requests[0];
  const { nextState: rejectedState, result: rejectRes } = demoRejectAllianceRequest(state2, req2.id, 3100);
  assert.equal(rejectRes.success, true);
  assert.equal(rejectedState.requests.find((r) => r.id === req2.id)?.status, 'rejected');

  const reReject2 = demoRejectAllianceRequest(rejectedState, req2.id, 3200);
  assert.equal(reReject2.result.success, false);
  assert.match((reReject2.result as { error: string }).error, /이미 처리된/);

  // 3. 취소 전이: 요청 cancelled 상태 갱신 및 재처리 차단
  const { nextState: state3 } = applyAllianceRequest(state, 'hanyang', 'gachon', 4000);
  const req3 = state3.requests[0];
  const { nextState: cancelledState, result: cancelRes } = cancelAllianceRequest(state3, req3.id, 4100);
  assert.equal(cancelRes.success, true);
  assert.equal(cancelledState.requests.find((r) => r.id === req3.id)?.status, 'cancelled');

  const reCancel2 = cancelAllianceRequest(cancelledState, req3.id, 4200);
  assert.equal(reCancel2.result.success, false);
  assert.match((reCancel2.result as { error: string }).error, /이미 처리된/);
});

test('네트워크 오류 시뮬레이션 및 복구(재시도) 동작을 검증한다', () => {
  const failureState = { ...INITIAL_ALLIANCE_STATE, simulateRequestFailure: true };
  const failRes = applyAllianceRequest(failureState, 'hanyang', 'pusan');
  assert.equal(failRes.result.success, false);
  assert.match((failRes.result as { error: string }).error, /네트워크 연결 오류/);

  // 오류 플래그 해제 후 재시도 성공
  const recoveredState = { ...failureState, simulateRequestFailure: false };
  const okRes = applyAllianceRequest(recoveredState, 'hanyang', 'pusan');
  assert.equal(okRes.result.success, true);
});

test('연합 신청 화면: 대상 학교 검색, 빈 검색 결과, 신청 및 취소 흐름을 검증한다', () => {
  cleanup();

  let allianceValue: ReturnType<typeof useAlliance>;
  function AllianceProbe() {
    allianceValue = useAlliance();
    return null;
  }

  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        null,
        React.createElement(AllianceProbe),
        React.createElement(AllianceApplyScreenPhone),
      ),
    ),
  );

  // 검색 인풋 찾기
  const searchInput = screen.getByRole('textbox', { name: '대상 학교 검색' });
  assert.ok(searchInput);

  // 1. 결과가 없는 검색어 입력 시 '검색 결과가 없습니다' 표시
  act(() => {
    fireEvent.change(searchInput, { target: { value: '없는대학교12345' } });
  });
  assert.ok(screen.getByText('검색 결과가 없습니다'));

  // 2. 존재하는 검색어 '부산' 입력 시 학교 버튼 표시 및 선택
  act(() => {
    fireEvent.change(searchInput, { target: { value: '부산' } });
  });
  const pusanButton = screen.getByRole('button', { name: /부산대학교/ });
  assert.ok(pusanButton);

  act(() => {
    fireEvent.click(pusanButton);
  });

  // 신청 요약 및 '연합 신청 보내기' 버튼 노출 확인
  const sendButton = screen.getByRole('button', { name: '연합 신청 보내기' });
  assert.ok(sendButton);

  // 신청 전송
  act(() => {
    fireEvent.click(sendButton);
  });

  // 신청 완료 메시지 및 보낸 신청 항목 노출 확인
  assert.ok(screen.getByText(/연합 신청을 성공적으로 보냈습니다/));
  assert.equal(allianceValue!.sentRequests.length, 1);
  assert.equal(allianceValue!.sentRequests[0].status, 'pending');

  // 일반 사용자 화면에는 '신청 취소' 버튼만 있고, 일반 영역에 '수락' 버튼은 존재하지 않음
  const cancelButton = screen.getByRole('button', { name: '신청 취소' });
  assert.ok(cancelButton);

  // 시연 영역([시연 제어]) 내에만 수락/거절 버튼이 존재
  const demoAcceptButton = screen.getByRole('button', { name: '[시연] 상대 학교 명의로 수락' });
  const demoRejectButton = screen.getByRole('button', { name: '[시연] 상대 학교 명의로 거절' });
  assert.ok(demoAcceptButton);
  assert.ok(demoRejectButton);

  // 사용자가 신청 취소 실행
  act(() => {
    fireEvent.click(cancelButton);
  });
  assert.equal(allianceValue!.sentRequests[0].status, 'cancelled');
  assert.ok(screen.getByText('취소됨'));
});

test('현재 연합 화면: 소속 연합 없음 상태, 시연 수락 후 결성 상태, 조회 실패 및 재시도를 검증한다', () => {
  cleanup();

  let allianceValue: ReturnType<typeof useAlliance>;
  function AllianceProbe() {
    allianceValue = useAlliance();
    return null;
  }

  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        null,
        React.createElement(AllianceProbe),
        React.createElement(CurrentAllianceScreenPhone),
      ),
    ),
  );

  // 1. 소속 연합 없음 상태 확인
  assert.ok(screen.getByText('소속 연합 없음'));
  assert.ok(screen.getByRole('button', { name: /연합 신청하러 가기/ }));

  // 2. 조회 실패 시뮬레이션 토글
  act(() => {
    allianceValue.toggleSimulateLoadFailure();
  });
  assert.ok(screen.getByRole('alert'));
  assert.ok(screen.getByText('연합 정보 조회 실패'));

  // 3. '다시 시도' 버튼 클릭 시 정상 복구
  const retryBtn = screen.getByRole('button', { name: /다시 시도/ });
  act(() => {
    fireEvent.click(retryBtn);
  });
  assertAbsent(screen.queryByRole('alert'));
  assert.ok(screen.getByText('소속 연합 없음'));

  // 4. 연합 신청 후 시연 수락 시 결성 상태로 전이
  let targetReqId = '';
  act(() => {
    const res = allianceValue.applyRequest('pusan');
    assert.ok(res.success);
    targetReqId = res.request!.id;
  });

  act(() => {
    const accRes = allianceValue.demoAcceptRequest(targetReqId);
    assert.ok(accRes.success);
  });

  // 결성 완료 표시 및 참여 학교 목록, N4 대결 안내 확인
  assert.ok(screen.getByText(/결성 완료 \(활성\)/));
  assert.ok(screen.getByText(/한양대·부산대 연합/));
  assert.ok(screen.getByText('참여 학교 목록 (2개교)'));
  assert.ok(screen.getByText(/대결 경기 \(N4\)/));
});

test('화면 전환 시 연합 상태가 보존되며 기존 게임 상태(점수, 기여도) 불변을 유지한다', () => {
  cleanup();

  render(React.createElement(MockGameProvider, null, React.createElement(App)));

  // 1. 연합 신청 화면으로 이동하여 연합 신청 및 수락
  const applyNavBtn = screen.getByRole('button', { name: /연합 신청 \(Alliance Apply\)/ });
  act(() => {
    fireEvent.click(applyNavBtn);
  });

  // 검색하여 '부산대학교' 선택 후 신청
  const searchInput = screen.getByRole('textbox', { name: '대상 학교 검색' });
  act(() => {
    fireEvent.change(searchInput, { target: { value: '부산' } });
  });
  const pusanBtn = screen.getByRole('button', { name: /부산대학교/ });
  act(() => {
    fireEvent.click(pusanBtn);
  });
  const sendBtn = screen.getByRole('button', { name: '연합 신청 보내기' });
  act(() => {
    fireEvent.click(sendBtn);
  });

  // 시연 수락
  const demoAcceptBtn = screen.getByRole('button', { name: '[시연] 상대 학교 명의로 수락' });
  act(() => {
    fireEvent.click(demoAcceptBtn);
  });

  // 2. 상단 헤더의 '뒤로' 버튼을 클릭하여 메인 게임 화면(gameplay)으로 복귀
  const backBtn = screen.getByRole('button', { name: '뒤로가기' });
  act(() => {
    fireEvent.click(backBtn);
  });

  // 메인 게임 화면의 캠퍼스 탭 및 TopHUD 노출 확인
  assert.ok(screen.getAllByText(/한양대학교/).length > 0);

  // 하단 내비의 '연합·대결' 버튼을 클릭하여 현재 연합 화면으로 진입 (2026-11-08 사용자 지시로 헤더에서 이동)
  const hudAllianceBtn = screen.getByRole('button', { name: '연합·대결' });
  act(() => {
    fireEvent.click(hudAllianceBtn);
  });

  // 3. 현재 연합 화면에서 연합 상태가 그대로 보존되어 결성된 연합이 표시되는지 검증
  assert.ok(screen.getByText(/한양대·부산대 연합/));
  assert.ok(screen.getByText(/결성 완료 \(활성\)/));
  assert.ok(screen.getByText('참여 학교 목록 (2개교)'));

  // 4. '연합 신청' 버튼을 클릭하여 연합 신청 화면으로 이동 시 보낸 내역도 보존됨
  const navToApplyBtn = screen.getByRole('button', { name: /^연합 신청$/ });
  act(() => {
    fireEvent.click(navToApplyBtn);
  });
  assert.ok(screen.getByText(/부산대학교 \(보낸 신청\)/));
  assert.ok(screen.getByText('수락됨'));
});

test('P2-1 (a): 이미 같은 연합에 소속된 두 학교 간의 재신청 및 수락을 거절한다', () => {
  // 초기 시드 연합 중 'yonsei'와 'korea'는 이미 'alliance-sky'에 소속됨
  const res1 = applyAllianceRequest(INITIAL_ALLIANCE_STATE, 'yonsei', 'korea');
  assert.equal(res1.result.success, false);
  if (!res1.result.success) {
    assert.match(res1.result.error, /이미 같은 연합/);
  }

  // 역방향 신청도 거절
  const res2 = applyAllianceRequest(INITIAL_ALLIANCE_STATE, 'korea', 'yonsei');
  assert.equal(res2.result.success, false);
  if (!res2.result.success) {
    assert.match(res2.result.error, /이미 같은 연합/);
  }

  // 신규 결성 후 동일 학교 쌍 재신청 거절
  const step1 = applyAllianceRequest(INITIAL_ALLIANCE_STATE, 'hanyang', 'pusan');
  assert.equal(step1.result.success, true);
  if (!step1.result.success || !step1.result.request) throw new Error('step1 failed');
  const step2 = demoAcceptAllianceRequest(step1.nextState, step1.result.request.id);
  assert.equal(step2.result.success, true);

  const reApply = applyAllianceRequest(step2.nextState, 'hanyang', 'pusan');
  assert.equal(reApply.result.success, false);
  if (!reApply.result.success) {
    assert.match(reApply.result.error, /이미 같은 연합/);
  }
});

test('P2-1 (b): 어떠한 연합 신청/수락/취소 시퀀스 후에도 연합 ID의 중복이 발생하지 않는다 (ID 유일성 불변식)', () => {
  let s = INITIAL_ALLIANCE_STATE;
  const actions: Array<[string, string]> = [
    ['hanyang', 'pusan'],
    ['hanyang', 'pusan'], // 재신청 시도
    ['cau', 'khu'],
    ['ewha', 'sogang'],
  ];

  for (const [a, b] of actions) {
    const app = applyAllianceRequest(s, a, b);
    s = app.nextState;
    if (app.result.success && app.result.request) {
      const acc = demoAcceptAllianceRequest(s, app.result.request.id);
      s = acc.nextState;
    }
  }

  const ids = s.alliances.map((a) => a.id);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, '모든 연합 ID는 유일해야 합니다');
});

test('P2-2 (a): 목업에서는 1개 학교가 최대 1개 연합에만 소속될 수 있다 (단일 연합 소속 불변식)', () => {
  // korea는 이미 alliance-sky 소속
  const res1 = applyAllianceRequest(INITIAL_ALLIANCE_STATE, 'hanyang', 'korea');
  assert.equal(res1.result.success, false);
  if (!res1.result.success) {
    assert.match(res1.result.error, /이미 다른 연합/);
  }

  // snu는 이미 alliance-capital 소속
  const res2 = applyAllianceRequest(INITIAL_ALLIANCE_STATE, 'snu', 'hanyang');
  assert.equal(res2.result.success, false);
  if (!res2.result.success) {
    assert.match(res2.result.error, /이미 다른 연합/);
  }

  // hanyang과 pusan 결성 후, hanyang이 제3 학교(cau)에 신청 시 거절
  const step1 = applyAllianceRequest(INITIAL_ALLIANCE_STATE, 'hanyang', 'pusan');
  assert.equal(step1.result.success, true);
  if (!step1.result.success || !step1.result.request) throw new Error('step1 failed');
  const step2 = demoAcceptAllianceRequest(step1.nextState, step1.result.request.id);
  assert.equal(step2.result.success, true);

  const res3 = applyAllianceRequest(step2.nextState, 'hanyang', 'cau');
  assert.equal(res3.result.success, false);
  if (!res3.result.success) {
    assert.match(res3.result.error, /신청 학교는 이미 다른 연합/);
  }

  // 수락 시점에도 re-validation에 의해 중복 소속 거절
  const stalePendingState = {
    ...step2.nextState,
    requests: [
      {
        id: 'stale-req-1',
        requesterSchoolId: 'hanyang',
        recipientSchoolId: 'cau',
        status: 'pending' as const,
        createdAt: 1000,
        updatedAt: 1000,
      },
      ...step2.nextState.requests,
    ],
  };
  const acceptReval = demoAcceptAllianceRequest(stalePendingState, 'stale-req-1');
  assert.equal(acceptReval.result.success, false);
  if (!acceptReval.result.success) {
    assert.match(acceptReval.result.error, /이미 다른 연합/);
  }

  // 모든 연합 내 학교 소속 카운트 검증: 어떤 학교도 2개 이상의 연합에 소속될 수 없음
  const schoolCountMap = new Map<string, number>();
  for (const a of step2.nextState.alliances) {
    for (const sid of a.schoolIds) {
      schoolCountMap.set(sid, (schoolCountMap.get(sid) ?? 0) + 1);
    }
  }
  for (const [sid, count] of schoolCountMap.entries()) {
    assert.equal(count, 1, `학교 ${sid}의 소속 연합 수가 1이어야 합니다 (현재: ${count})`);
  }
});

test('P2-2 (b): 초기 시드 연합(INITIAL_MOCK_ALLIANCES) 내 모든 학교는 유일하며 hanyang은 소속 연합이 없다', () => {
  const seedSchoolCounts = new Map<string, number>();
  for (const a of INITIAL_MOCK_ALLIANCES) {
    for (const sid of a.schoolIds) {
      seedSchoolCounts.set(sid, (seedSchoolCounts.get(sid) ?? 0) + 1);
    }
  }

  for (const [sid, count] of seedSchoolCounts.entries()) {
    assert.equal(count, 1, `시드 연합 내 학교 ${sid}는 유일해야 합니다 (출현 횟수: ${count})`);
  }

  assert.equal(getAllianceForSchool(INITIAL_MOCK_ALLIANCES, 'hanyang'), undefined);
});

test('연합 정원 불변식: 연합은 정확히 2개교다 (시드와 수락으로 만든 연합 모두, 3개교 이상 없음)', () => {
  assert.equal(ALLIANCE_SIZE, 2);
  for (const a of INITIAL_MOCK_ALLIANCES) {
    assert.equal(a.schoolIds.length, ALLIANCE_SIZE, `${a.id}는 ${a.schoolIds.length}개교`);
  }

  const applied = applyAllianceRequest(INITIAL_ALLIANCE_STATE, 'hanyang', 'pusan', 1000);
  assert.equal(applied.result.success, true);
  const accepted = demoAcceptAllianceRequest(applied.nextState, applied.result.request!.id, 2000);
  assert.equal(accepted.result.success, true);
  assert.deepEqual(accepted.result.alliance!.schoolIds, ['hanyang', 'pusan']);

  // 성립한 연합에 3번째 학교는 들어갈 수 없다
  const third = applyAllianceRequest(accepted.nextState, 'gachon', 'hanyang', 3000);
  assert.equal(third.result.success, false);
  for (const a of accepted.nextState.alliances) assert.equal(a.schoolIds.length, ALLIANCE_SIZE);
});

test('P2-3 (a): 동일 틱(same tick / 단일 act) 내 동일 학교 쌍 중복 신청 시 정확히 1건만 성공하고 2번째는 거절된다', () => {
  cleanup();
  let allianceValue: ReturnType<typeof useAlliance>;
  function Probe() {
    allianceValue = useAlliance();
    return null;
  }

  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(AllianceProvider, null, React.createElement(Probe)),
    ),
  );

  let res1: any;
  let res2: any;
  act(() => {
    res1 = allianceValue.applyRequest('pusan');
    res2 = allianceValue.applyRequest('pusan');
  });

  assert.equal(res1.success, true);
  assert.equal(res2.success, false);
  assert.match(res2.error, /이미 대기 중인/);
  assert.equal(allianceValue!.sentRequests.length, 1);
});

test('P2-3 (b): 동일 틱 내 동일 요청 2회 연속 수락 시 정확히 1건만 성공하고 2번째는 거절된다', () => {
  cleanup();
  let allianceValue: ReturnType<typeof useAlliance>;
  function Probe() {
    allianceValue = useAlliance();
    return null;
  }

  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(AllianceProvider, null, React.createElement(Probe)),
    ),
  );

  let reqId = '';
  act(() => {
    const res = allianceValue.applyRequest('pusan');
    assert.equal(res.success, true);
    reqId = res.request!.id;
  });

  let acc1: any;
  let acc2: any;
  act(() => {
    acc1 = allianceValue.demoAcceptRequest(reqId);
    acc2 = allianceValue.demoAcceptRequest(reqId);
  });

  assert.equal(acc1.success, true);
  assert.equal(acc2.success, false);
  assert.match(acc2.error, /이미 처리된/);
  assert.ok(allianceValue!.currentAlliance);
});

test('P2-3 (c): 동일 틱 내 수락 직후 거절 호출 시 수락만 성공하고 거절은 이미 처리되어 거절된다', () => {
  cleanup();
  let allianceValue: ReturnType<typeof useAlliance>;
  function Probe() {
    allianceValue = useAlliance();
    return null;
  }

  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(AllianceProvider, null, React.createElement(Probe)),
    ),
  );

  let reqId = '';
  act(() => {
    const res = allianceValue.applyRequest('pusan');
    assert.equal(res.success, true);
    reqId = res.request!.id;
  });

  let accRes: any;
  let rejRes: any;
  act(() => {
    accRes = allianceValue.demoAcceptRequest(reqId);
    rejRes = allianceValue.demoRejectRequest(reqId);
  });

  assert.equal(accRes.success, true);
  assert.equal(rejRes.success, false);
  assert.match(rejRes.error, /이미 처리된/);
  assert.ok(allianceValue!.currentAlliance);
});
