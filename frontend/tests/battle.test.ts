import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import { assertAbsent } from './helpers/domAssert';
import type { BattleState } from '../src/data/battleModel.ts';

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
  applyBattleRequest,
  getDefaultRequestedStartTime,
  validateRequestedStartTime,
  parseKstDateTimeLocal,
  formatKstDateTimeLocal,
  cancelBattleRequest,
  demoAcceptBattleRequest,
  demoRejectBattleRequest,
  demoCancelConfirmedBattle,
  determineBattleWinner,
  getBattleResultLabel,
  getEffectiveBattleStatus,
  formatBattleTimestamp,
  formatBattleRemainingTime,
  isAllianceOccupied,
  createInitialBattleState,
  INITIAL_BATTLE_STATE,
  INITIAL_MOCK_BATTLES,
} = await import('../src/data/battleModel.ts');
const { MOCK_SHOP_CONFIG } = await import('../src/data/mockShopConfig.ts');
const { INITIAL_MOCK_ALLIANCES, INITIAL_ALLIANCE_STATE } = await import('../src/data/allianceModel.ts');
const { BattleProvider, useBattle } = await import('../src/hooks/useMockBattle.tsx');
const { AllianceProvider } = await import('../src/hooks/useMockAlliance.tsx');
const { MockGameProvider, useMockGame } = await import('../src/hooks/useMockGame.tsx');
const { SharedImageProvider, useImageStore } = await import('../src/hooks/useSharedImages.tsx');
const { BattleApplyScreenPhone } = await import('../src/components/BattleApplyScreenPhone.tsx');
const { BattleStatusScreenPhone } = await import('../src/components/BattleStatusScreenPhone.tsx');
const { default: App } = await import('../src/App.tsx');

afterEach(() => cleanup());
after(() => {
  assetHooks.deregister();
  dom.window.close();
});

test('1. 대결 신청 및 현황 화면 진입·복귀와 네비게이션 간 상태(대결, 연합, 게임) 보존', () => {
  cleanup();
  render(React.createElement(MockGameProvider, null, React.createElement(App)));

  // 1. 데모 상단 런처에서 '대결 신청' 진입 버튼 클릭 (초기 소속 연합 없음 상태 확인)
  const launcherBattleApplyBtn = screen.getByRole('button', { name: '⚔️ 대결 신청 (Battle Apply)' });
  act(() => {
    fireEvent.click(launcherBattleApplyBtn);
  });
  assert.ok(screen.getByRole('heading', { name: '대결 신청' }));
  assert.ok(screen.getByText('소속 연합 없음'));

  // 2. 상단 런처 또는 헤더에서 '대결 현황' 진입 버튼 클릭
  const launcherBattleStatusBtn = screen.getByRole('button', { name: '대결 현황' });
  act(() => {
    fireEvent.click(launcherBattleStatusBtn);
  });
  assert.ok(screen.getByRole('heading', { name: '대결 현황' }));
  assert.ok(screen.getAllByText(/연합별 2개교/).length > 0);
  assert.equal(screen.queryAllByText(/연합별 3개교/).length, 0, '3:3 대결은 없다');

  // 3. '🛡️ 현재 연합 (Current Alliance)' 런처 버튼으로 현재 연합 화면 이동
  const launcherCurAllianceBtn = screen.getByRole('button', { name: '🛡️ 현재 연합 (Current Alliance)' });
  act(() => {
    fireEvent.click(launcherCurAllianceBtn);
  });
  assert.ok(screen.getByRole('heading', { name: '현재 연합' }));

  // 4. 뒤로가기 클릭 -> 메인 게임 화면 복귀
  const backToGameBtn = screen.getByRole('button', { name: '뒤로가기' });
  act(() => {
    fireEvent.click(backToGameBtn);
  });
  assert.ok(screen.getAllByText(/한양대학교/).length > 0);

  // 5. 독립 화면 마운트 검증
  cleanup();
  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        null,
        React.createElement(BattleProvider, null, React.createElement(BattleApplyScreenPhone)),
      ),
    ),
  );
  assert.ok(screen.getByRole('heading', { name: '대결 신청' }));
});

test('2. 2개교 연합끼리만(2:2) 대결 가능, 전이(pending→accept→active→finished), 무승부 샘플, 오류 재시도', () => {
  const state = INITIAL_BATTLE_STATE;
  const alliances = INITIAL_MOCK_ALLIANCES;

  // (a) 2개교가 아닌 연합은 신청·수락 모두 거절 (3개교 연합은 구현하지 않으며, 방어 검증만 남긴다)
  const oversized = { id: 'alliance-oversized', name: '3개교 연합(비정상)', schoolIds: ['kaist', 'postech', 'unist'], createdAt: 0 };
  const withOversized = [...alliances.filter((a) => a.id !== 'alliance-tech'), oversized];
  const mismatchRes = applyBattleRequest(state, withOversized, 'alliance-oversized', 'alliance-capital', 24, getDefaultRequestedStartTime(1000, state.config), 1000);
  assert.equal(mismatchRes.result.success, false);
  assert.match(mismatchRes.result.error!, /연합 규모 오류: 대결은 2개교 연합끼리만/);

  const seedPending = state.battles.find((b) => b.id === 'battle-sample-pending-2v2')!;
  const acceptOversized = demoAcceptBattleRequest(state, withOversized.map((a) => (a.id === 'alliance-oversized' ? { ...a, id: 'alliance-tech' } : a)), seedPending.id, seedPending.createdAt);
  assert.equal(acceptOversized.result.success, false);
  assert.match(acceptOversized.result.error!, /연합 규모 오류/);

  // (b) 정상 신청 (sky -> capital, 2:2, 24h)
  const applyRes = applyBattleRequest(state, alliances, 'alliance-sky', 'alliance-capital', 24, getDefaultRequestedStartTime(2000, state.config), 2000);
  assert.equal(applyRes.result.success, true);
  const pendingBattle = applyRes.result.battle!;
  assert.equal(pendingBattle.status, 'pending');
  assert.equal(pendingBattle.requesterSchoolIds.length, 2);
  assert.equal(pendingBattle.recipientSchoolIds.length, 2);

  // (c) 시연 수락 -> 예정(scheduled) 및 고정 시계 경과에 따른 진행(active) 전이 (P3-1)
  const acceptRes = demoAcceptBattleRequest(applyRes.nextState, alliances, pendingBattle.id, 2100);
  assert.equal(acceptRes.result.success, true);
  const acceptedBattle = acceptRes.result.battle!;
  assert.equal(acceptedBattle.status, 'scheduled');
  const delayMs = pendingBattle.requestedStartTime - 2100;
  assert.equal(acceptedBattle.scheduledStartTime, pendingBattle.requestedStartTime);
  assert.equal(acceptedBattle.scheduledEndTime, pendingBattle.requestedStartTime + 24 * 3600_000);

  // (d) 고정 시계 검증: 시작 전 scheduled, 진행 중 active, 종료 후 finished
  const effBeforeStart = getEffectiveBattleStatus(acceptedBattle, 2100);
  assert.equal(effBeforeStart, 'scheduled');

  const effInActive = getEffectiveBattleStatus(acceptedBattle, 2100 + delayMs + 1000);
  assert.equal(effInActive, 'active');

  const effAfterEnd = getEffectiveBattleStatus(acceptedBattle, 2100 + delayMs + 24 * 3600_000 + 1000);
  assert.equal(effAfterEnd, 'finished');

  // (e) 시드에 무승부 및 종료 샘플 존재 검증
  const drawSample = INITIAL_MOCK_BATTLES.find((b) => b.winnerAllianceId === 'draw');
  assert.ok(drawSample);
  assert.equal(drawSample.requesterSchoolIds.length, 2);
  assert.equal(drawSample.recipientSchoolIds.length, 2);
  assert.equal(drawSample.scores?.requesterScore, drawSample.scores?.recipientScore);

  // (f) 네트워크 오류 시뮬레이션 및 복구
  const failState = { ...state, simulateRequestFailure: true };
  const failRes = applyBattleRequest(failState, alliances, 'alliance-sky', 'alliance-capital', 24, getDefaultRequestedStartTime(3000, failState.config), 3000);
  assert.equal(failRes.result.success, false);
  assert.match(failRes.result.error!, /네트워크 연결 오류/);

  // (g) 취소 및 거절 전이 검증
  const cancelTestApp = applyBattleRequest(state, alliances, 'alliance-sky', 'alliance-capital', 24, getDefaultRequestedStartTime(4000, state.config), 4000);
  const cancelRes = cancelBattleRequest(cancelTestApp.nextState, cancelTestApp.result.battle!.id, 4100);
  assert.equal(cancelRes.result.success, true);
  assert.equal(cancelRes.result.battle!.status, 'cancelled');

  const rejectTestApp = applyBattleRequest(state, alliances, 'alliance-sky', 'alliance-capital', 24, getDefaultRequestedStartTime(5000, state.config), 5000);
  const rejectRes = demoRejectBattleRequest(rejectTestApp.nextState, rejectTestApp.result.battle!.id, 5100);
  assert.equal(rejectRes.result.success, true);
  assert.equal(rejectRes.result.battle!.status, 'rejected');
});

test('4. 기간 설정(min, max, 범위 밖 거절), 남은 시간 계산 및 종료 후 절대 active 미노출', () => {
  const { min, max } = MOCK_SHOP_CONFIG.battle.durationHours;
  const alliances = INITIAL_MOCK_ALLIANCES;
  const state = INITIAL_BATTLE_STATE;

  // 최소 미만 거절
  const underMin = applyBattleRequest(state, alliances, 'alliance-sky', 'alliance-capital', min - 1, getDefaultRequestedStartTime(1000, state.config), 1000);
  assert.equal(underMin.result.success, false);
  assert.match(underMin.result.error!, /유효하지 않은 대결 기간/);

  // 최대 초과 거절
  const overMax = applyBattleRequest(state, alliances, 'alliance-sky', 'alliance-capital', max + 1, getDefaultRequestedStartTime(1000, state.config), 1000);
  assert.equal(overMax.result.success, false);
  assert.match(overMax.result.error!, /유효하지 않은 대결 기간/);

  // 경계값(min, max)은 성공
  const atMin = applyBattleRequest(state, alliances, 'alliance-sky', 'alliance-capital', min, getDefaultRequestedStartTime(1000, state.config), 1000);
  assert.equal(atMin.result.success, true);

  // 종료 시각 이후 effective status는 결코 active가 아닌 finished
  const b = atMin.result.battle!;
  const accepted = demoAcceptBattleRequest(atMin.nextState, alliances, b.id, 1000);
  assert.equal(accepted.result.success, true);

  const activeB = accepted.result.battle!;
  const startTime = activeB.scheduledStartTime!;
  const endTime = activeB.scheduledEndTime!;
  assert.equal(getEffectiveBattleStatus(activeB, startTime - 1), 'scheduled');
  assert.equal(getEffectiveBattleStatus(activeB, startTime + 1000), 'active');
  assert.equal(getEffectiveBattleStatus(activeB, endTime - 1), 'active');
  assert.equal(getEffectiveBattleStatus(activeB, endTime), 'finished');
  assert.equal(getEffectiveBattleStatus(activeB, endTime + 10000), 'finished');
});

test('5. 학교 이미지 변경 시 대결 화면의 로고가 즉시 갱신된다', () => {
  cleanup();
  let imageStore: ReturnType<typeof useImageStore>;
  function ImageProbe() {
    imageStore = useImageStore();
    return null;
  }

  render(
    React.createElement(
      SharedImageProvider,
      null,
      React.createElement(
        MockGameProvider,
        null,
        React.createElement(
          AllianceProvider,
          null,
          React.createElement(
            BattleProvider,
            null,
            React.createElement(ImageProbe),
            React.createElement(BattleStatusScreenPhone),
          ),
        ),
      ),
    ),
  );

  // KAIST('kaist') 로고 확인 (초기 폴백 '카')
  assert.ok(screen.getAllByText('카').length > 0);

  // 공유 이미지 저장소에 KAIST 소속 사용자('external-viewer') 권한으로 새 로고 적용
  act(() => {
    const success = imageStore.apply(
      'external-viewer',
      { type: 'school', id: 'kaist' },
      'https://example.com/custom_kaist.svg',
      'req-kaist-battle-1',
    );
    assert.equal(success, true);
  });

  // 커스텀 이미지로 SharedImage가 즉각 갱신되어 alt="KAIST 이미지" 태그가 모든 해당 경기 카드에 렌더링됨
  const kaistImgs = screen.getAllByRole('img', { name: 'KAIST 이미지' });
  assert.ok(kaistImgs.length >= 2);
  for (const img of kaistImgs) {
    assert.equal(img.getAttribute('src'), 'https://example.com/custom_kaist.svg');
  }
});

test('6. 대결 시연 및 상태 조작은 실제 기여도, 학교/학과 점수, 클리커, 버프를 일체 변경하지 않는다', () => {
  cleanup();
  let gameValue: ReturnType<typeof useMockGame>;
  let battleValue: ReturnType<typeof useBattle>;

  function Probe() {
    gameValue = useMockGame();
    battleValue = useBattle();
    return null;
  }

  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        null,
        React.createElement(BattleProvider, null, React.createElement(Probe)),
      ),
    ),
  );

  const initialContribution = gameValue!.state.contribution;
  const initialSchoolScore = gameValue!.state.schoolScore;
  const initialClickerLevel = gameValue!.clicker.level;
  const initialMultiplier = gameValue!.normalPower;

  // 대결 수락 및 가상 시계 조작 실행
  act(() => {
    battleValue.demoAcceptRequest('battle-sample-pending-2v2');
    battleValue.fastForwardClock(48);
  });

  // 게임 상태 불변성 검증
  assert.equal(gameValue!.state.contribution, initialContribution);
  assert.equal(gameValue!.state.schoolScore, initialSchoolScore);
  assert.equal(gameValue!.clicker.level, initialClickerLevel);
  assert.equal(gameValue!.normalPower, initialMultiplier);
});

test('3. 단일 동시 상대 제한: A-B 예정·진행 중에는 A-C/B-D 신청과 오래된 수락을 거절하고, 종료·취소 후 해제한다', () => {
  const alliances = INITIAL_MOCK_ALLIANCES;
  let s: BattleState = { ...INITIAL_BATTLE_STATE, battles: [] };
  const now = 20000;

  // Stale request 사전 생성: A(sky)와 C(metro) 간의 pending 요청
  const staleApp = applyBattleRequest(s, alliances, 'alliance-sky', 'alliance-metro', 24, getDefaultRequestedStartTime(now, s.config), now);
  assert.equal(staleApp.result.success, true);
  s = staleApp.nextState;
  const staleReqId = staleApp.result.battle!.id;

  // A-B 신청 및 수락
  const abApp = applyBattleRequest(s, alliances, 'alliance-sky', 'alliance-capital', 24, getDefaultRequestedStartTime(now + 10, s.config), now + 10);
  assert.equal(abApp.result.success, true);
  s = abApp.nextState;

  const abAcc = demoAcceptBattleRequest(s, alliances, abApp.result.battle!.id, now + 20);
  assert.equal(abAcc.result.success, true);
  s = abAcc.nextState;
  const abBattle = abAcc.result.battle!;

  // 1. 수락 직후: 상태는 'scheduled', 실효 상태도 'scheduled'
  assert.equal(abBattle.status, 'scheduled');
  assert.equal(getEffectiveBattleStatus(abBattle, now + 20), 'scheduled');

  // 2. 예정(scheduled) 상태에서 A와 B 모두 점유됨
  assert.equal(isAllianceOccupied(s.battles, 'alliance-sky', now + 20), true);
  assert.equal(isAllianceOccupied(s.battles, 'alliance-capital', now + 20), true);

  // 3. 예정 상태에서 신규 A-C 및 B-D 신청 거절
  const acAppScheduled = applyBattleRequest(s, alliances, 'alliance-sky', 'alliance-metro', 24, getDefaultRequestedStartTime(now + 30, s.config), now + 30);
  assert.equal(acAppScheduled.result.success, false);
  assert.match(acAppScheduled.result.error!, /단일 동시 상대 제한/);

  const bdAppScheduled = applyBattleRequest(s, alliances, 'alliance-sinchon', 'alliance-capital', 24, getDefaultRequestedStartTime(now + 30, s.config), now + 30);
  assert.equal(bdAppScheduled.result.success, false);
  assert.match(bdAppScheduled.result.error!, /단일 동시 상대 제한/);

  // 4. 예정 상태에서 기존 stale A-C 수락 거절
  const staleAccScheduled = demoAcceptBattleRequest(s, alliances, staleReqId, now + 40);
  assert.equal(staleAccScheduled.result.success, false);
  assert.match(staleAccScheduled.result.error!, /단일 동시 상대 제한/);

  // 5. 시작 시각 도달 후 진행(active) 상태 전이 검증
  const activeTime = abBattle.scheduledStartTime! + 1000;
  assert.equal(getEffectiveBattleStatus(abBattle, activeTime), 'active');
  assert.equal(isAllianceOccupied(s.battles, 'alliance-sky', activeTime), true);
  assert.equal(isAllianceOccupied(s.battles, 'alliance-capital', activeTime), true);

  // 5-1. 진행(active) 상태에서도 신규 A-C 및 B-D 신청과 stale A-C 수락을 거절
  const acAppActive = applyBattleRequest(s, alliances, 'alliance-sky', 'alliance-metro', 24, getDefaultRequestedStartTime(activeTime, s.config), activeTime);
  assert.equal(acAppActive.result.success, false);
  assert.match(acAppActive.result.error!, /단일 동시 상대 제한/);

  const bdAppActive = applyBattleRequest(s, alliances, 'alliance-sinchon', 'alliance-capital', 24, getDefaultRequestedStartTime(activeTime, s.config), activeTime);
  assert.equal(bdAppActive.result.success, false);
  assert.match(bdAppActive.result.error!, /단일 동시 상대 제한/);

  const staleAccActive = demoAcceptBattleRequest(s, alliances, staleReqId, activeTime);
  assert.equal(staleAccActive.result.success, false);
  assert.match(staleAccActive.result.error!, /단일 동시 상대 제한/);

  // 5-2. 취소 없이 종료 시각이 지나면 점유가 해제되어 새 A-C 신청이 가능
  const afterEnd = abBattle.scheduledEndTime! + 1000;
  assert.equal(getEffectiveBattleStatus(abBattle, afterEnd), 'finished');
  assert.equal(isAllianceOccupied(s.battles, 'alliance-sky', afterEnd), false);
  assert.equal(isAllianceOccupied(s.battles, 'alliance-capital', afterEnd), false);
  const finishedState = cancelBattleRequest(s, staleReqId, afterEnd).nextState;
  const acAppAfterFinish = applyBattleRequest(finishedState, alliances, 'alliance-sky', 'alliance-metro', 24, getDefaultRequestedStartTime(afterEnd + 10, finishedState.config), afterEnd + 10);
  assert.equal(acAppAfterFinish.result.success, true);

  // 6. 시연용 확정 대결 취소(demoCancelConfirmedBattle)로 점유 해제
  const cancelConfirmedRes = demoCancelConfirmedBattle(s, abBattle.id, activeTime);
  assert.equal(cancelConfirmedRes.result.success, true);
  assert.equal(cancelConfirmedRes.result.battle!.status, 'cancelled');
  s = cancelConfirmedRes.nextState;

  // 7. 취소 후 양측 점유 해제 확인
  assert.equal(isAllianceOccupied(s.battles, 'alliance-sky', activeTime), false);
  assert.equal(isAllianceOccupied(s.battles, 'alliance-capital', activeTime), false);

  // 8. 점유 해제 후 stale 요청 취소 및 신규 A-C 신청 성공
  s = cancelBattleRequest(s, staleReqId, activeTime).nextState;
  const acAppAfterCancel = applyBattleRequest(s, alliances, 'alliance-sky', 'alliance-metro', 24, getDefaultRequestedStartTime(activeTime + 10, s.config), activeTime + 10);
  assert.equal(acAppAfterCancel.result.success, true);
});

test('3-1. 같은 tick에 같은 대결 요청을 두 번 수락하면 정확히 한 번만 성공한다', () => {
  cleanup();
  let battleValue: ReturnType<typeof useBattle>;
  function Probe() {
    battleValue = useBattle();
    return null;
  }

  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        null,
        React.createElement(BattleProvider, null, React.createElement(Probe)),
      ),
    ),
  );

  const pendingId = 'battle-sample-pending-2v2';
  let acc1: any;
  let acc2: any;
  act(() => {
    acc1 = battleValue.demoAcceptRequest(pendingId);
    acc2 = battleValue.demoAcceptRequest(pendingId);
  });
  assert.equal(acc1.success, true);
  assert.equal(acc2.success, false);
  assert.match(acc2.error, /이미 처리된/);
  assert.equal(battleValue!.state.battles.filter((b) => b.id === pendingId).length, 1);
});

test('8. P3-2: 대결 설정 주입 가능성: 대체 설정 반영, 범위 밖 거절, UI 동적 반영', () => {
  const alliances = INITIAL_MOCK_ALLIANCES;
  const customConfig = {
    durationHours: { min: 1, max: 5, default: 2, presets: [1, 3, 6] },
    startTime: { ...MOCK_SHOP_CONFIG.battle.startTime, allowedStartHoursKst: { from: 10, to: 20 }, stepMinutes: 60 },
  };
  const customState = createInitialBattleState(10000, customConfig);
  const start = getDefaultRequestedStartTime(10000, customConfig);

  // (a) 6시간은 기본 설정(1~24h)에서는 허용되나 customConfig(max 5)에서는 거절
  const overCustomMax = applyBattleRequest(customState, alliances, 'alliance-sky', 'alliance-capital', 6, start, 10000, customConfig);
  assert.equal(overCustomMax.result.success, false);
  assert.match(overCustomMax.result.error!, /1시간 ~ 5시간 허용/);

  // (b) 1시간은 customConfig(min 1)에서 정상 신청
  const atCustomMin = applyBattleRequest(customState, alliances, 'alliance-sky', 'alliance-capital', 1, start, 10000, customConfig);
  assert.equal(atCustomMin.result.success, true);

  // (c) 희망 시작 시각이 그대로 확정되는지 검증
  const acceptedCustom = demoAcceptBattleRequest(atCustomMin.nextState, alliances, atCustomMin.result.battle!.id, 10000, customConfig);
  assert.equal(acceptedCustom.result.success, true);
  const cb = acceptedCustom.result.battle!;
  assert.equal(cb.scheduledStartTime, atCustomMin.result.battle!.requestedStartTime);
  assert.equal(cb.scheduledEndTime, cb.scheduledStartTime! + 3600_000);

  // (d) UI: 주입한 범위와 프리셋을 쓰고, 범위 밖 프리셋(6h)은 숨긴다
  cleanup();
  const allianceState = { ...INITIAL_ALLIANCE_STATE, alliances: [...INITIAL_ALLIANCE_STATE.alliances, { id: 'alliance-hanyang-pusan', name: '한양대·부산대 연합', schoolIds: ['hanyang', 'pusan'], createdAt: 1000 }] };
  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        { initialState: allianceState } as any,
        React.createElement(BattleProvider, { config: customConfig }, React.createElement(BattleApplyScreenPhone)),
      ),
    ),
  );
  assert.ok(screen.getByText(/허용: 1h ~ 5h/));
  assert.ok(screen.getByRole('button', { name: '1h' }));
  assert.ok(screen.getByRole('button', { name: '3h' }));
  assertAbsent(screen.queryByRole('button', { name: '6h' }));
  assert.equal(screen.getByRole('status', { name: '경기 진행 기간 선택값' }).textContent, '2시간');
});

test('2:2 고정 불변식: 대결 시드는 양측 2개교·기간 1~24h이고, 신청 화면에 형식 선택이 없으며 프리셋 기간으로 신청된다', () => {
  const { min, max } = MOCK_SHOP_CONFIG.battle.durationHours;
  assert.deepEqual([min, max], [1, 24]);
  for (const b of INITIAL_MOCK_BATTLES) {
    assert.equal(b.requesterSchoolIds.length, 2, b.id);
    assert.equal(b.recipientSchoolIds.length, 2, b.id);
    assert.ok(b.durationHours >= min && b.durationHours <= max, `${b.id}: ${b.durationHours}h`);
    assert.equal('format' in b, false, `${b.id}에 format 필드가 남아 있음`);
  }

  cleanup();
  const allianceState = { ...INITIAL_ALLIANCE_STATE, alliances: [...INITIAL_ALLIANCE_STATE.alliances, { id: 'alliance-hanyang-pusan', name: '한양대·부산대 연합', schoolIds: ['hanyang', 'pusan'], createdAt: 1000 }] };
  let battleValue: ReturnType<typeof useBattle>;
  function Probe() { battleValue = useBattle(); return null; }
  render(React.createElement(MockGameProvider, null, React.createElement(AllianceProvider, { initialState: allianceState } as any, React.createElement(BattleProvider, null, React.createElement(Probe), React.createElement(BattleApplyScreenPhone)))));

  assertAbsent(screen.queryByText(/대결 형식 선택/));
  assertAbsent(screen.queryByRole('button', { name: /3:3 대결/ }));
  assertAbsent(screen.queryByRole('spinbutton', { name: '경기 진행 기간' }));
  assert.ok(screen.getByRole('group', { name: '경기 진행 기간' }));

  fireEvent.click(screen.getByRole('button', { name: /연고 메이저 연합/ }));
  fireEvent.click(screen.getByRole('button', { name: '12h' }));
  fireEvent.click(screen.getByRole('button', { name: '경기 진행 기간 1시간 늘리기' }));
  assert.match(screen.getByText(/• 형식:/).textContent ?? '', /2:2 \(연합당 2개교\)/);
  const before = battleValue!.state.battles.length;
  fireEvent.click(screen.getByRole('button', { name: '대결 신청 보내기' }));
  assert.equal(battleValue!.state.battles.length, before + 1);
  assert.equal(battleValue!.state.battles[0].durationHours, 13);
});

test('9. P3-3: 시계에 의해 종료된 대결 및 무승부/리드 결과 판정, 상대 연합 승리 오표기 방지, 실제 시계 기준 시드 active 검증', () => {
  // 1. determineBattleWinner 순수 함수 검증
  const dummyRequester = 'alliance-req';
  const dummyRecipient = 'alliance-rec';

  const reqWinBattle: any = {
    id: 'test-req-win',
    requesterAllianceId: dummyRequester,
    recipientAllianceId: dummyRecipient,
    scores: { requesterScore: 12000, recipientScore: 11000 },
  };
  assert.equal(determineBattleWinner(reqWinBattle), 'requester');
  assert.equal(getBattleResultLabel(reqWinBattle, '신청연합', '상대연합'), '신청연합 승리');

  const recWinBattle: any = {
    id: 'test-rec-win',
    requesterAllianceId: dummyRequester,
    recipientAllianceId: dummyRecipient,
    scores: { requesterScore: 9000, recipientScore: 15000 },
  };
  assert.equal(determineBattleWinner(recWinBattle), 'recipient');
  assert.equal(getBattleResultLabel(recWinBattle, '신청연합', '상대연합'), '상대연합 승리');

  // 0:0 동점 대결 -> 결코 recipient wins가 아니라 'draw'
  const zeroZeroBattle: any = {
    id: 'test-zero-zero',
    requesterAllianceId: dummyRequester,
    recipientAllianceId: dummyRecipient,
    scores: { requesterScore: 0, recipientScore: 0 },
  };
  assert.equal(determineBattleWinner(zeroZeroBattle), 'draw');
  assert.equal(getBattleResultLabel(zeroZeroBattle, '신청연합', '상대연합'), '무승부 (DRAW)');

  // 2. 실제 시계(Date.now()) 기준 시드 active 샘플 검증
  const realNow = Date.now();
  const seedActive = INITIAL_MOCK_BATTLES.find((b) => b.id === 'battle-sample-active-2v2');
  assert.ok(seedActive);
  assert.equal(getEffectiveBattleStatus(seedActive, realNow), 'active');
  assert.equal(determineBattleWinner(seedActive), 'requester'); // 12450 > 11800

  // 3. BattleStatusScreenPhone 화면 렌더링 검증
  cleanup();
  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        null,
        React.createElement(BattleProvider, null, React.createElement(BattleStatusScreenPhone)),
      ),
    ),
  );

  // '리드 중' (경인연합 우세 진행 중) 렌더링 확인
  assert.ok(screen.getAllByText(/리드 중/).length > 0);

  // '무승부 (DRAW)' 및 '결과: 샘플 점수 기준' 렌더링 확인
  assert.ok(screen.getAllByText('무승부 (DRAW)').length > 0);
  assert.ok(screen.getAllByText('결과: 샘플 점수 기준').length > 0);
});

test('P4-2: formatBattleTimestamp 및 formatBattleRemainingTime 순수 헬퍼 고정 시계 검증', () => {
  // 1. formatBattleTimestamp 결정론적 포맷팅 (UTC+9 고정)
  // Date.UTC(2026, 10, 7, 3, 30, 0) => KST 2026-11-07 12:30
  const fixedTs = Date.UTC(2026, 10, 7, 3, 30, 0);
  assert.equal(formatBattleTimestamp(fixedTs), '11/07 12:30');
  assert.equal(formatBattleTimestamp(undefined), '-');
  assert.equal(formatBattleTimestamp(Number.NaN), '-');

  // 2. formatBattleRemainingTime 시계 경계값 검증
  // startTime = 10_000_000, endTime = 20_000_000 (duration = 10_000_000 ms ~= 2.77 hours)
  const scheduledStartTime = 10_000_000;
  const scheduledEndTime = 20_000_000;
  const testBattle: any = {
    id: 'test-timing-battle',
    status: 'scheduled',
    scheduledStartTime,
    scheduledEndTime,
    durationHours: 24,
  };

  // (a) before start (now = 5_000_000): scheduled, diff = 5_000_000 ms (1시간 23분)
  const beforeStart = formatBattleRemainingTime(testBattle, 5_000_000);
  assert.match(beforeStart, /^시작까지 \d+시간 \d+분 남음$/);
  assert.equal(beforeStart, '시작까지 1시간 23분 남음');

  // (b) exactly at start (now = 10_000_000): active, diff = 10_000_000 ms (2시간 46분)
  const atStart = formatBattleRemainingTime(testBattle, 10_000_000);
  assert.match(atStart, /^종료까지 \d+시간 \d+분 남음$/);
  assert.equal(atStart, '종료까지 2시간 46분 남음');

  // (c) between start and end (now = 15_000_000): active, diff = 5_000_000 ms (1시간 23분)
  const between = formatBattleRemainingTime(testBattle, 15_000_000);
  assert.match(between, /^종료까지 \d+시간 \d+분 남음$/);
  assert.equal(between, '종료까지 1시간 23분 남음');

  // (d) exactly at end (now = 20_000_000): finished
  const atEnd = formatBattleRemainingTime(testBattle, 20_000_000);
  assert.equal(atEnd, '종료됨');

  // (e) after end (now = 25_000_000): finished
  const afterEnd = formatBattleRemainingTime(testBattle, 25_000_000);
  assert.equal(afterEnd, '종료됨');

  // (f) pending battle
  const pendingBattle: any = { id: 'pending-1', status: 'pending' };
  assert.equal(formatBattleRemainingTime(pendingBattle, 5_000_000), '수락 대기 중');
});

test('P4-2: BattleStatusScreenPhone 화면에서 시작/종료 시각 및 예정(시작까지)/진행(종료까지) 안내 렌더링', (t) => {
  const baseTime = Date.UTC(2026, 10, 7, 0, 0, 0); // KST 09:00
  t.mock.method(Date, 'now', () => baseTime);

  const scheduledStart = baseTime + 3600_000; // KST 10:00
  const scheduledEnd = scheduledStart + 24 * 3600_000; // Next day KST 10:00

  const customState = {
    ...createInitialBattleState(baseTime, MOCK_SHOP_CONFIG.battle),
    battles: [
      {
        id: 'test-scheduled-card',
        requesterAllianceId: 'alliance-seoul-univs',
        recipientAllianceId: 'alliance-gyeongin',
        requesterSchoolIds: ['hanyang', 'pusan'],
        recipientSchoolIds: ['yonsei', 'korea'],
        durationHours: 24,
        status: 'scheduled' as const,
        createdAt: baseTime,
        requestedStartTime: scheduledStart,
        scheduledStartTime: scheduledStart,
        scheduledEndTime: scheduledEnd,
        updatedAt: baseTime,
      },
    ],
  };

  cleanup();
  // 1. baseTime 시점: 경기 예정 상태 (시작 전)
  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        null,
        React.createElement(
          BattleProvider,
          { initialState: customState },
          React.createElement(BattleStatusScreenPhone),
        ),
      ),
    ),
  );

  // 시작 / 종료 시각 렌더링 확인
  assert.ok(screen.getAllByText(/시작: 11\/07 10:00/).length > 0);
  assert.ok(screen.getAllByText(/종료: 11\/08 10:00/).length > 0);
  // 예정 상태: '시작까지' 카운트다운 확인
  assert.ok(screen.getByText('시작까지 1시간 0분 남음'));

  // 2. baseTime + 2시간 경과: 진행 중 상태
  cleanup();
  const activeState = {
    ...customState,
    demoClockOffsetMs: 2 * 3600_000, // now = baseTime + 2h (scheduledStart + 1h)
  };

  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        null,
        React.createElement(
          BattleProvider,
          { initialState: activeState },
          React.createElement(BattleStatusScreenPhone),
        ),
      ),
    ),
  );

  // 진행 중 상태: '종료까지' 카운트다운 확인 (23시간 0분 남음)
  assert.ok(screen.getByText('종료까지 23시간 0분 남음'));
  assert.ok(screen.getAllByText(/시작: 11\/07 10:00/).length > 0);
  assert.ok(screen.getAllByText(/종료: 11\/08 10:00/).length > 0);
});

test('대결 신청 UI의 시간 경계와 유효하지 않은 입력 및 정상 신청', (t) => {
  const now = Date.UTC(2026, 10, 7, 0);
  t.mock.method(Date, 'now', () => now);
  const allianceState = { ...INITIAL_ALLIANCE_STATE, alliances: [...INITIAL_ALLIANCE_STATE.alliances, { id: 'alliance-hanyang-pusan', name: '한양대·부산대 연합', schoolIds: ['hanyang', 'pusan'], createdAt: now }] };
  let battleValue: ReturnType<typeof useBattle>;
  function Probe() { battleValue = useBattle(); return null; }
  render(React.createElement(MockGameProvider, null, React.createElement(AllianceProvider, { initialState: allianceState } as any, React.createElement(BattleProvider, null, React.createElement(Probe), React.createElement(BattleApplyScreenPhone)))));
  const input = screen.getByLabelText('시작 일시 (KST)') as HTMLInputElement;
  assert.equal(input.min, '2026-11-07T10:00');
  assert.equal(input.max, '2026-11-14T09:00');
  assert.equal(input.step, '1800');
  const opponent = screen.getByRole('button', { name: /연고 메이저 연합/ });
  fireEvent.click(opponent);
  const before = battleValue!.state.battles.length;
  fireEvent.change(input, { target: { value: '2026-11-07T08:30' } });
  assert.ok(screen.getByRole('alert'));
  assert.equal((screen.getByRole('button', { name: '대결 신청 보내기' }) as HTMLButtonElement).disabled, true);
  assert.equal(battleValue!.state.battles.length, before);
  fireEvent.change(input, { target: { value: '2026-11-07T11:00' } });
  fireEvent.click(screen.getByRole('button', { name: '대결 신청 보내기' }));
  assert.equal(battleValue!.state.battles.length, before + 1);
  assert.equal(battleValue!.state.battles[0].requestedStartTime, parseKstDateTimeLocal('2026-11-07T11:00'));
});

test('희망 시작 시각 KST 경계, 기본값, 설정 주입 및 만료 수락', () => {
  const config = MOCK_SHOP_CONFIG.battle;
  const now = parseKstDateTimeLocal('2026-11-07T08:00');
  const at = (value: string) => parseKstDateTimeLocal(value);
  for (const value of [NaN, Infinity, at('2026-11-07T08:30'), at('2026-11-07T22:30'), at('2026-11-07T10:15'), at('2026-11-15T09:00')]) {
    assert.equal(validateRequestedStartTime(value, now, config).success, false);
  }
  for (const value of ['2026-11-07T09:00', '2026-11-07T22:00']) {
    assert.equal(validateRequestedStartTime(at(value), now, config).success, true);
  }
  const upperNow = at('2026-11-07T10:00');
  assert.equal(validateRequestedStartTime(at('2026-11-14T10:00'), upperNow, config).success, true);
  assert.equal(validateRequestedStartTime(at('2026-11-14T10:30'), upperNow, config).success, false);
  assert.equal(formatKstDateTimeLocal(getDefaultRequestedStartTime(at('2026-11-07T21:50'), config)), '2026-11-08T09:00');
  assert.equal(formatKstDateTimeLocal(getDefaultRequestedStartTime(at('2026-11-07T12:20'), config)), '2026-11-07T14:00');
  assert.equal(at('2026-11-07T09:00'), Date.UTC(2026, 10, 7, 0));
  const alternate = { ...config, startTime: { ...config.startTime, allowedStartHoursKst: { from: 10, to: 20 }, stepMinutes: 60 } };
  assert.equal(validateRequestedStartTime(at('2026-11-07T09:00'), now, alternate).success, false);
  assert.equal(formatKstDateTimeLocal(getDefaultRequestedStartTime(now, alternate)), '2026-11-07T10:00');
  const state = { ...createInitialBattleState(now), battles: [] };
  const start = at('2026-11-07T10:00');
  const applied = applyBattleRequest(state, INITIAL_MOCK_ALLIANCES, 'alliance-sky', 'alliance-capital', 24, start, now);
  assert.equal(applied.result.success, true);
  const late = demoAcceptBattleRequest(applied.nextState, INITIAL_MOCK_ALLIANCES, applied.result.battle!.id, start - 60 * 60_000 + 1);
  assert.equal(late.result.success, false);
  assert.equal(late.nextState, applied.nextState);
  const accepted = demoAcceptBattleRequest(applied.nextState, INITIAL_MOCK_ALLIANCES, applied.result.battle!.id, start - 60 * 60_000);
  assert.equal(accepted.result.battle!.scheduledStartTime, start);
  assert.equal(accepted.result.battle!.scheduledEndTime, start + 24 * 3600_000);
  assert.equal(getEffectiveBattleStatus(accepted.result.battle!, start), 'active');
  assert.equal(getEffectiveBattleStatus(accepted.result.battle!, start + 24 * 3600_000), 'finished');
});

test('P4-3: BattleApplyScreenPhone 설정 기반 시작 대기 및 진행 기간 동적 표기 검증', () => {
  cleanup();
  const testAllianceState = {
    ...INITIAL_ALLIANCE_STATE,
    alliances: [
      ...INITIAL_ALLIANCE_STATE.alliances,
      {
        id: 'alliance-hanyang-pusan',
        name: '한양대·부산대 연합',
        schoolIds: ['hanyang', 'pusan'],
        createdAt: 1000,
      },
    ],
  };

  // 1. 기본 시작 시간 설정
  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        { initialState: testAllianceState } as any,
        React.createElement(BattleProvider, null, React.createElement(BattleApplyScreenPhone)),
      ),
    ),
  );

  // 기본 시작 시간 안내 확인
  assert.ok(screen.getByText(/09:00~22:00 시작 · 30분 단위/));

  // 2. 대체 시작 시간과 기간 설정 주입
  cleanup();
  const alternateBattleConfig = {
    ...MOCK_SHOP_CONFIG.battle,
    startTime: { ...MOCK_SHOP_CONFIG.battle.startTime, allowedStartHoursKst: { from: 10, to: 20 }, stepMinutes: 60 },
    durationHours: { min: 2, max: 20, default: 12, presets: [2, 12, 20] },
  };

  render(
    React.createElement(
      MockGameProvider,
      null,
      React.createElement(
        AllianceProvider,
        { initialState: testAllianceState } as any,
        React.createElement(
          BattleProvider,
          { config: alternateBattleConfig },
          React.createElement(BattleApplyScreenPhone),
        ),
      ),
    ),
  );

  // 대체 시작 시간 안내 확인
  assert.ok(screen.getByText(/10:00~20:00 시작 · 60분 단위/));
});
