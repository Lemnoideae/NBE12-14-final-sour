// 대결 상태 모델 및 순수 전이 함수 (N4 대결 신청 및 현황)
// 기획서 4-2, 6장, 10·11장 및 팀장 범위 갱신 계획 5절 기반
import { MOCK_SHOP_CONFIG, type MockBattleConfig } from './mockShopConfig.ts';
import type { Alliance } from './allianceModel.ts';

export type BattleConfig = MockBattleConfig;

export type BattleStatus = 'pending' | 'scheduled' | 'active' | 'finished' | 'rejected' | 'cancelled';

export interface BattleScore {
  readonly requesterScore: number;
  readonly recipientScore: number;
}

export interface Battle {
  readonly id: string;
  readonly format: number; // 연합별 학교 수 (2: 2개교 vs 2개교, 3: 3개교 vs 3개교)
  readonly requesterAllianceId: string;
  readonly recipientAllianceId: string;
  readonly requesterSchoolIds: readonly string[]; // 참여 학교 ID 스냅샷
  readonly recipientSchoolIds: readonly string[]; // 참여 학교 ID 스냅샷
  readonly durationHours: number;
  readonly requestedStartTime: number;
  readonly status: BattleStatus;
  readonly createdAt: number;
  readonly scheduledStartTime?: number;
  readonly scheduledEndTime?: number;
  readonly scores?: BattleScore;
  readonly winnerAllianceId?: string | 'draw';
  readonly updatedAt: number;
}

export interface BattleActionResult {
  readonly success: boolean;
  readonly error?: string;
  readonly battle?: Battle;
}

export interface BattleState {
  readonly battles: readonly Battle[];
  readonly demoClockOffsetMs: number;
  readonly simulateRequestFailure: boolean;
  readonly simulateLoadFailure: boolean;
  readonly config: BattleConfig;
}

// 고정 시계 및 기간 경과에 따른 실효적 상태 계산
// 종료 시각이 지난 경기는 어떤 경우에도 active로 표시되지 않고 finished로 판정된다.
export function getEffectiveBattleStatus(battle: Battle, now: number): BattleStatus {
  if (battle.status === 'scheduled') {
    if (battle.scheduledEndTime != null && now >= battle.scheduledEndTime) {
      return 'finished';
    }
    if (battle.scheduledStartTime != null && now >= battle.scheduledStartTime) {
      return 'active';
    }
    return 'scheduled';
  }
  if (battle.status === 'active') {
    if (battle.scheduledEndTime != null && now >= battle.scheduledEndTime) {
      return 'finished';
    }
    return 'active';
  }
  return battle.status;
}

// P4-2: 결정론적 시각 포맷팅 함수 (KST UTC+9 기준 고정 변환, 로케일/타임존 독립)
export function formatBattleTimestamp(timestamp?: number): string {
  if (timestamp == null || !Number.isFinite(timestamp)) return '-';
  const kstOffsetMs = 9 * 3600_000;
  const d = new Date(timestamp + kstOffsetMs);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

const KST_OFFSET = 9 * 3600_000;
const DAY_MS = 24 * 3600_000;

export function formatKstDateTimeLocal(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '';
  const d = new Date(timestamp + KST_OFFSET);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
}

export function parseKstDateTimeLocal(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(`${value}:00Z`) - KST_OFFSET;
  return formatKstDateTimeLocal(timestamp) === value ? timestamp : NaN;
}

export function validateRequestedStartTime(time: number, now: number, config: BattleConfig): BattleActionResult {
  const { minLeadMinutes, maxLeadDays, allowedStartHoursKst, stepMinutes } = config.startTime;
  if (!Number.isFinite(time)) return { success: false, error: '유효한 시작 일시를 입력해주세요.' };
  if (time < now + minLeadMinutes * 60_000) return { success: false, error: `최소 ${minLeadMinutes}분 이후로 선택해주세요.` };
  if (time > now + maxLeadDays * DAY_MS) return { success: false, error: `최대 ${maxLeadDays}일 이내로 선택해주세요.` };
  const local = new Date(time + KST_OFFSET);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  if (minutes < allowedStartHoursKst.from * 60 || minutes > allowedStartHoursKst.to * 60) return { success: false, error: '허용된 KST 시작 시간대를 선택해주세요.' };
  if (minutes % stepMinutes !== 0 || local.getUTCSeconds() !== 0 || local.getUTCMilliseconds() !== 0) return { success: false, error: `${stepMinutes}분 단위로 선택해주세요.` };
  return { success: true };
}

export function getDefaultRequestedStartTime(now: number, config: BattleConfig): number {
  const earliest = now + config.startTime.minLeadMinutes * 60_000;
  const localDay = Math.floor((earliest + KST_OFFSET) / DAY_MS) * DAY_MS - KST_OFFSET;
  const step = config.startTime.stepMinutes * 60_000;
  for (let day = 0; day <= config.startTime.maxLeadDays + 1; day++) {
    const start = localDay + day * DAY_MS + config.startTime.allowedStartHoursKst.from * 3600_000;
    const end = localDay + day * DAY_MS + config.startTime.allowedStartHoursKst.to * 3600_000;
    const first = Math.max(start, earliest);
    const hour = Math.ceil((first + KST_OFFSET) / 3600_000) * 3600_000 - KST_OFFSET;
    if (hour <= end && validateRequestedStartTime(hour, now, config).success) return hour;
    const aligned = Math.ceil((first + KST_OFFSET) / step) * step - KST_OFFSET;
    if (aligned <= end && validateRequestedStartTime(aligned, now, config).success) return aligned;
  }
  return NaN;
}

// P4-2: 실효적 상태에 따른 남은 시간/일정 안내 레이블 순수 함수
export function formatBattleRemainingTime(battle: Battle, now: number): string {
  const effStatus = getEffectiveBattleStatus(battle, now);
  if (effStatus === 'finished') {
    return '종료됨';
  }
  if (effStatus === 'scheduled') {
    if (battle.scheduledStartTime == null) return '시작 대기';
    const diff = battle.scheduledStartTime - now;
    if (diff <= 0) return '시작 직전';
    const totalMinutes = Math.floor(diff / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `시작까지 ${hours}시간 ${mins}분 남음`;
  }
  if (effStatus === 'active') {
    if (battle.scheduledEndTime == null) return '진행 중';
    const diff = battle.scheduledEndTime - now;
    if (diff <= 0) return '종료 직전';
    const totalMinutes = Math.floor(diff / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `종료까지 ${hours}시간 ${mins}분 남음`;
  }
  if (effStatus === 'pending') {
    return '수락 대기 중';
  }
  if (effStatus === 'cancelled') {
    return '취소됨';
  }
  if (effStatus === 'rejected') {
    return '거절됨';
  }
  return '-';
}

// P3-3: 대결 결과 및 승자 판정 순수 함수 (미지정 필드 fallthrough 방지)
export type BattleWinner = 'requester' | 'recipient' | 'draw' | 'undecided';

export function determineBattleWinner(battle: Battle): BattleWinner {
  if (battle.winnerAllianceId === 'draw') return 'draw';
  if (battle.winnerAllianceId && battle.winnerAllianceId === battle.requesterAllianceId) return 'requester';
  if (battle.winnerAllianceId && battle.winnerAllianceId === battle.recipientAllianceId) return 'recipient';

  if (battle.scores) {
    if (battle.scores.requesterScore > battle.scores.recipientScore) return 'requester';
    if (battle.scores.recipientScore > battle.scores.requesterScore) return 'recipient';
    return 'draw'; // 점수 동점(0:0 포함)은 무승부
  }

  return 'undecided';
}

export function getBattleResultLabel(battle: Battle, requesterName: string, recipientName: string): string {
  const winner = determineBattleWinner(battle);
  if (winner === 'draw') return '무승부 (DRAW)';
  if (winner === 'requester') return `${requesterName} 승리`;
  if (winner === 'recipient') return `${recipientName} 승리`;
  return '결과 미정';
}

// 동시 상대 제한 검사 (단일 동시 상대 원칙 - 확정 정책):
// 예정(scheduled) 또는 진행(active) 중인 경기가 있는 연합은 다른 대결을 확정할 수 없음.
export function isAllianceOccupied(battles: readonly Battle[], allianceId: string, now: number): boolean {
  return battles.some((b) => {
    if (b.requesterAllianceId !== allianceId && b.recipientAllianceId !== allianceId) {
      return false;
    }
    const effStatus = getEffectiveBattleStatus(b, now);
    return effStatus === 'scheduled' || effStatus === 'active';
  });
}

export function getOccupiedBattleForAlliance(
  battles: readonly Battle[],
  allianceId: string,
  now: number,
): Battle | undefined {
  return battles.find((b) => {
    if (b.requesterAllianceId !== allianceId && b.recipientAllianceId !== allianceId) {
      return false;
    }
    const effStatus = getEffectiveBattleStatus(b, now);
    return effStatus === 'scheduled' || effStatus === 'active';
  });
}

// P3-3: 기준 시각(baseTime)에 비례한 초기 모의 대결 시드 생성 (실제 시계 기준 active 상태 보장)
export function createInitialMockBattles(baseTime: number = Date.now(), config: BattleConfig = MOCK_SHOP_CONFIG.battle): readonly Battle[] {
  return Object.freeze([
    // 샘플 1: 2:2 종료된 경기 (연고 vs 수도권, 연고 승리)
    Object.freeze({
      id: 'battle-sample-finished-2v2',
      format: 2,
      requesterAllianceId: 'alliance-sky',
      recipientAllianceId: 'alliance-capital',
      requesterSchoolIds: Object.freeze(['yonsei', 'korea']),
      recipientSchoolIds: Object.freeze(['snu', 'skku']),
      durationHours: 24,
      status: 'finished' as const,
      createdAt: baseTime - 48 * 3600_000,
      requestedStartTime: baseTime - 48 * 3600_000,
      scheduledStartTime: baseTime - 48 * 3600_000,
      scheduledEndTime: baseTime - 24 * 3600_000,
      scores: Object.freeze({ requesterScore: 18400, recipientScore: 16920 }),
      winnerAllianceId: 'alliance-sky',
      updatedAt: baseTime - 24 * 3600_000,
    }),
    // 샘플 2: 3:3 종료된 무승부 경기 (과기원 vs 서울삼각, 무승부)
    Object.freeze({
      id: 'battle-sample-draw-3v3',
      format: 3,
      requesterAllianceId: 'alliance-tech',
      recipientAllianceId: 'alliance-korea-central',
      requesterSchoolIds: Object.freeze(['kaist', 'postech', 'unist']),
      recipientSchoolIds: Object.freeze(['cau', 'khu', 'hufs']),
      durationHours: 24,
      status: 'finished' as const,
      createdAt: baseTime - 36 * 3600_000,
      requestedStartTime: baseTime - 36 * 3600_000,
      scheduledStartTime: baseTime - 36 * 3600_000,
      scheduledEndTime: baseTime - 12 * 3600_000,
      scores: Object.freeze({ requesterScore: 25000, recipientScore: 25000 }),
      winnerAllianceId: 'draw' as const,
      updatedAt: baseTime - 12 * 3600_000,
    }),
    // 샘플 3: 2:2 진행 중인 경기 (경인 vs 신촌, 경인 리드 중)
    // 시작: 과거 2시간 전, 종료: 미래 22시간 후 -> baseTime 시점에 정확히 active 상태
    Object.freeze({
      id: 'battle-sample-active-2v2',
      format: 2,
      requesterAllianceId: 'alliance-metro',
      recipientAllianceId: 'alliance-sinchon',
      requesterSchoolIds: Object.freeze(['inha', 'ajou']),
      recipientSchoolIds: Object.freeze(['sogang', 'ewha']),
      durationHours: 24,
      status: 'scheduled' as const,
      createdAt: baseTime - 3 * 3600_000,
      requestedStartTime: baseTime - 2 * 3600_000,
      scheduledStartTime: baseTime - 2 * 3600_000,
      scheduledEndTime: baseTime + 22 * 3600_000,
      scores: Object.freeze({ requesterScore: 12450, recipientScore: 11800 }),
      updatedAt: baseTime - 2 * 3600_000,
    }),
    // 샘플 4: 3:3 대기 중인 경기 신청 (호남 -> 과기원)
    Object.freeze({
      requestedStartTime: getDefaultRequestedStartTime(baseTime, config),
      id: 'battle-sample-pending-3v3',
      format: 3,
      requesterAllianceId: 'alliance-honam',
      recipientAllianceId: 'alliance-tech',
      requesterSchoolIds: Object.freeze(['chonnam', 'jbnu', 'gist']),
      recipientSchoolIds: Object.freeze(['kaist', 'postech', 'unist']),
      durationHours: 24,
      status: 'pending' as const,
      createdAt: baseTime - 1800_000,
      updatedAt: baseTime - 1800_000,
    }),
  ]);
}

export const INITIAL_MOCK_BATTLES: readonly Battle[] = createInitialMockBattles(Date.now());

export function createInitialBattleState(
  baseTime: number = Date.now(),
  config: BattleConfig = MOCK_SHOP_CONFIG.battle,
): BattleState {
  return Object.freeze({
    battles: createInitialMockBattles(baseTime, config),
    demoClockOffsetMs: 0,
    simulateRequestFailure: false,
    simulateLoadFailure: false,
    config,
  });
}

export const INITIAL_BATTLE_STATE: BattleState = createInitialBattleState(Date.now(), MOCK_SHOP_CONFIG.battle);

export function applyBattleRequest(
  state: BattleState,
  alliances: readonly Alliance[],
  requesterAllianceId: string,
  recipientAllianceId: string,
  format: number,
  durationHours: number,
  requestedStartTime: number,
  now: number = Date.now(),
  config: BattleConfig = state.config ?? MOCK_SHOP_CONFIG.battle,
): { nextState: BattleState; result: BattleActionResult } {
  if (state.simulateRequestFailure) {
    return {
      nextState: state,
      result: { success: false, error: '네트워크 연결 오류: 대결 신청에 실패했습니다.' },
    };
  }

  if (requesterAllianceId === recipientAllianceId) {
    return {
      nextState: state,
      result: { success: false, error: '자기 연합에는 대결을 신청할 수 없습니다.' },
    };
  }

  const reqAlliance = alliances.find((a) => a.id === requesterAllianceId);
  if (!reqAlliance) {
    return {
      nextState: state,
      result: { success: false, error: '신청 연합 정보를 찾을 수 없습니다.' },
    };
  }

  const recAlliance = alliances.find((a) => a.id === recipientAllianceId);
  if (!recAlliance) {
    return {
      nextState: state,
      result: { success: false, error: '대상 상대 연합 정보를 찾을 수 없습니다.' },
    };
  }

  // 중복 참여 학교 검사
  const hasSchoolOverlap = reqAlliance.schoolIds.some((id) => recAlliance.schoolIds.includes(id));
  if (hasSchoolOverlap) {
    return {
      nextState: state,
      result: { success: false, error: '양측 연합에 중복된 참여 학교가 존재합니다.' },
    };
  }

  // 형식 및 학교 수 검사 (설정 기반 동적 검사)
  if (!config.schoolCounts.includes(format)) {
    return {
      nextState: state,
      result: { success: false, error: `지원하지 않는 대결 형식입니다 (${format}:${format}).` },
    };
  }

  if (reqAlliance.schoolIds.length !== format || recAlliance.schoolIds.length !== format) {
    return {
      nextState: state,
      result: {
        success: false,
        error: `학교 수 불일치: 선택된 대결 형식(${format}:${format})과 연합의 실제 학교 수(신청: ${reqAlliance.schoolIds.length}개교, 대상: ${recAlliance.schoolIds.length}개교)가 일치하지 않습니다.`,
      },
    };
  }

  // 기간 검사 (주입된 config.durationHours 동적 반영)
  const { min, max } = config.durationHours;
  if (durationHours < min || durationHours > max) {
    return {
      nextState: state,
      result: {
        success: false,
        error: `유효하지 않은 대결 기간입니다 (${min}시간 ~ ${max}시간 허용, 입력: ${durationHours}시간).`,
      },
    };
  }

  // 동시 상대 제한: 이미 진행 또는 예정 중인 대결이 있는 연합은 신청 불가
  if (isAllianceOccupied(state.battles, requesterAllianceId, now)) {
    return {
      nextState: state,
      result: {
        success: false,
        error: '신청 연합은 이미 진행 중이거나 예정된 대결이 있습니다 (단일 동시 상대 제한).',
      },
    };
  }

  if (isAllianceOccupied(state.battles, recipientAllianceId, now)) {
    return {
      nextState: state,
      result: {
        success: false,
        error: '대상 상대 연합은 이미 진행 중이거나 예정된 대결이 있습니다 (단일 동시 상대 제한).',
      },
    };
  }

  // 동일 연합 간 중복 pending 요청 검사
  const hasPending = state.battles.some(
    (b) =>
      b.status === 'pending' &&
      ((b.requesterAllianceId === requesterAllianceId && b.recipientAllianceId === recipientAllianceId) ||
        (b.requesterAllianceId === recipientAllianceId && b.recipientAllianceId === requesterAllianceId)),
  );
  if (hasPending) {
    return {
      nextState: state,
      result: { success: false, error: '이미 해당 연합 간 대기 중인 대결 신청이 존재합니다.' },
    };
  }

  const validation = validateRequestedStartTime(requestedStartTime, now, config);
  if (!validation.success) return { nextState: state, result: validation };

  const newBattle: Battle = Object.freeze({
    id: `battle-${requesterAllianceId}-${recipientAllianceId}-${now}`,
    format,
    requesterAllianceId,
    recipientAllianceId,
    requesterSchoolIds: Object.freeze([...reqAlliance.schoolIds]),
    recipientSchoolIds: Object.freeze([...recAlliance.schoolIds]),
    durationHours,
    requestedStartTime,
    status: 'pending' as const,
    createdAt: now,
    updatedAt: now,
  });

  return {
    nextState: Object.freeze({
      ...state,
      battles: Object.freeze([newBattle, ...state.battles]),
    }),
    result: { success: true, battle: newBattle },
  };
}

export function cancelBattleRequest(
  state: BattleState,
  battleId: string,
  now: number = Date.now(),
): { nextState: BattleState; result: BattleActionResult } {
  const target = state.battles.find((b) => b.id === battleId);
  if (!target) {
    return { nextState: state, result: { success: false, error: '존재하지 않는 대결 요청입니다.' } };
  }

  if (target.status !== 'pending') {
    return {
      nextState: state,
      result: { success: false, error: `대기 중인 신청만 취소할 수 있습니다 (현재 상태: ${target.status}).` },
    };
  }

  const updatedBattle = Object.freeze({
    ...target,
    status: 'cancelled' as const,
    updatedAt: now,
  });

  return {
    nextState: Object.freeze({
      ...state,
      battles: Object.freeze(state.battles.map((b) => (b.id === battleId ? updatedBattle : b))),
    }),
    result: { success: true, battle: updatedBattle },
  };
}

export function demoAcceptBattleRequest(
  state: BattleState,
  alliances: readonly Alliance[],
  battleId: string,
  now: number = Date.now(),
  config: BattleConfig = state.config ?? MOCK_SHOP_CONFIG.battle,
): { nextState: BattleState; result: BattleActionResult } {
  const target = state.battles.find((b) => b.id === battleId);
  if (!target) {
    return { nextState: state, result: { success: false, error: '존재하지 않는 대결 요청입니다.' } };
  }

  if (target.status !== 'pending') {
    return { nextState: state, result: { success: false, error: '이미 처리된 대결 요청입니다.' } };
  }

  const reqAlliance = alliances.find((a) => a.id === target.requesterAllianceId);
  const recAlliance = alliances.find((a) => a.id === target.recipientAllianceId);

  if (!reqAlliance || !recAlliance) {
    return { nextState: state, result: { success: false, error: '연합 정보를 확인할 수 없습니다.' } };
  }

  // 수락 시점 학교 수 재검증
  if (reqAlliance.schoolIds.length !== target.format || recAlliance.schoolIds.length !== target.format) {
    return {
      nextState: state,
      result: {
        success: false,
        error: `학교 수 불일치: 대결 형식(${target.format}:${target.format})과 현재 연합 학교 수가 맞지 않습니다.`,
      },
    };
  }

  // 동시 상대 제한 재검증: 수락 직전 양측 연합이 다른 경기에 점유되었는지 검사
  if (isAllianceOccupied(state.battles, target.requesterAllianceId, now)) {
    return {
      nextState: state,
      result: {
        success: false,
        error: '수락 불가: 신청 연합은 이미 진행 또는 예정 중인 대결이 있습니다 (단일 동시 상대 제한).',
      },
    };
  }

  if (isAllianceOccupied(state.battles, target.recipientAllianceId, now)) {
    return {
      nextState: state,
      result: {
        success: false,
        error: '수락 불가: 대상 상대 연합은 이미 진행 또는 예정 중인 대결이 있습니다 (단일 동시 상대 제한).',
      },
    };
  }

  if (now > target.requestedStartTime - config.startTime.minLeadMinutes * 60_000) {
    return { nextState: state, result: { success: false, error: '희망 시작 시간이 지났거나 너무 가까워졌습니다. 신청자에게 다시 신청해달라고 요청해주세요.' } };
  }
  const scheduledStartTime = target.requestedStartTime;
  const scheduledEndTime = scheduledStartTime + target.durationHours * 3600_000;

  const acceptedBattle = Object.freeze({
    ...target,
    status: 'scheduled' as const,
    scheduledStartTime,
    scheduledEndTime,
    scores: Object.freeze({ requesterScore: 0, recipientScore: 0 }),
    updatedAt: now,
  });

  return {
    nextState: Object.freeze({
      ...state,
      battles: Object.freeze(state.battles.map((b) => (b.id === battleId ? acceptedBattle : b))),
    }),
    result: { success: true, battle: acceptedBattle },
  };
}

export function demoRejectBattleRequest(
  state: BattleState,
  battleId: string,
  now: number = Date.now(),
): { nextState: BattleState; result: BattleActionResult } {
  const target = state.battles.find((b) => b.id === battleId);
  if (!target) {
    return { nextState: state, result: { success: false, error: '존재하지 않는 대결 요청입니다.' } };
  }

  if (target.status !== 'pending') {
    return { nextState: state, result: { success: false, error: '이미 처리된 대결 요청입니다.' } };
  }

  const rejectedBattle = Object.freeze({
    ...target,
    status: 'rejected' as const,
    updatedAt: now,
  });

  return {
    nextState: Object.freeze({
      ...state,
      battles: Object.freeze(state.battles.map((b) => (b.id === battleId ? rejectedBattle : b))),
    }),
    result: { success: true, battle: rejectedBattle },
  };
}

// P3-1: 시연용 확정 대결(예정 또는 진행) 취소 및 점유 해제 함수
// 일반 사용자에게는 취소 권한이 제공되지 않으며 시연 제어 영역에서만 수행 가능
export function demoCancelConfirmedBattle(
  state: BattleState,
  battleId: string,
  now: number = Date.now(),
): { nextState: BattleState; result: BattleActionResult } {
  const target = state.battles.find((b) => b.id === battleId);
  if (!target) {
    return { nextState: state, result: { success: false, error: '존재하지 않는 대결 요청입니다.' } };
  }

  const effectiveStatus = getEffectiveBattleStatus(target, now);
  if (effectiveStatus !== 'scheduled' && effectiveStatus !== 'active') {
    return {
      nextState: state,
      result: {
        success: false,
        error: `예정되거나 진행 중인 대결만 시연 취소할 수 있습니다 (현재 실효 상태: ${effectiveStatus}).`,
      },
    };
  }

  const cancelledBattle = Object.freeze({
    ...target,
    status: 'cancelled' as const,
    updatedAt: now,
  });

  return {
    nextState: Object.freeze({
      ...state,
      battles: Object.freeze(state.battles.map((b) => (b.id === battleId ? cancelledBattle : b))),
    }),
    result: { success: true, battle: cancelledBattle },
  };
}
