import { REAL_UNIVERSITIES } from './universitiesData.ts';

export type AllianceRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface AllianceRequest {
  id: string;
  requesterSchoolId: string;
  recipientSchoolId: string;
  status: AllianceRequestStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Alliance {
  id: string;
  name: string;
  schoolIds: readonly string[];
  createdAt: number;
}

export function isValidSchoolId(schoolId: string): boolean {
  if (!schoolId) return false;
  if (schoolId === 'blue-sea') return true;
  return REAL_UNIVERSITIES.some((u) => u.id === schoolId);
}

export function getSchoolInfo(schoolId: string) {
  if (schoolId === 'blue-sea') {
    return { id: 'blue-sea', name: '푸른바다대학교', shortName: '푸른바다대', firstSyllable: '푸', badgeColor: '#0d9488', region: '경상' };
  }
  const found = REAL_UNIVERSITIES.find((u) => u.id === schoolId);
  if (found) return found;
  return { id: schoolId, name: schoolId, shortName: schoolId, firstSyllable: schoolId[0] ?? '?', badgeColor: '#888888', region: '기타' };
}

/**
 * 연합은 정확히 2개교로 구성된다 (3개교 이상 연합은 구현하지 않음). 대결도 2:2만 가능하다.
 * 근거: ERD 결정 18 (.agents/261111-1356-project_plan_reference.md), 사용자 지시 2026-11-12.
 */
export const ALLIANCE_SIZE = 2;

export const INITIAL_MOCK_ALLIANCES: readonly Alliance[] = Object.freeze([
  Object.freeze({
    id: 'alliance-sky',
    name: '연고 메이저 연합',
    schoolIds: Object.freeze(['yonsei', 'korea']),
    createdAt: 1700000000000,
  }),
  Object.freeze({
    id: 'alliance-capital',
    name: '수도권 동맹',
    schoolIds: Object.freeze(['snu', 'skku']),
    createdAt: 1700000010000,
  }),
  Object.freeze({
    id: 'alliance-metro',
    name: '경인 메트로 연합',
    schoolIds: Object.freeze(['inha', 'ajou']),
    createdAt: 1700000020000,
  }),
  Object.freeze({
    id: 'alliance-sinchon',
    name: '신촌 연합',
    schoolIds: Object.freeze(['sogang', 'ewha']),
    createdAt: 1700000025000,
  }),
  Object.freeze({
    id: 'alliance-tech',
    name: '과학기술원 연합',
    schoolIds: Object.freeze(['kaist', 'postech']),
    createdAt: 1700000030000,
  }),
  Object.freeze({
    id: 'alliance-korea-central',
    name: '서울 중앙 연합',
    schoolIds: Object.freeze(['cau', 'khu']),
    createdAt: 1700000040000,
  }),
  Object.freeze({
    id: 'alliance-honam',
    name: '호남 플래그십 연합',
    schoolIds: Object.freeze(['chonnam', 'jbnu']),
    createdAt: 1700000050000,
  }),
]);

// 목업 단순화 규칙: 단일 학교는 최대 1개 연합에만 소속될 수 있음 (실제 서비스 정책 미정)
export function getAllianceForSchool(alliances: readonly Alliance[], schoolId: string): Alliance | undefined {
  return alliances.find((a) => a.schoolIds.includes(schoolId));
}

export interface AllianceState {
  alliances: readonly Alliance[];
  requests: readonly AllianceRequest[];
  simulateRequestFailure: boolean;
  simulateLoadFailure: boolean;
}

export const INITIAL_ALLIANCE_STATE: AllianceState = Object.freeze({
  alliances: INITIAL_MOCK_ALLIANCES,
  requests: Object.freeze([]),
  simulateRequestFailure: false,
  simulateLoadFailure: false,
});

export type AllianceActionResult =
  | { success: true; request?: AllianceRequest; alliance?: Alliance }
  | { success: false; error: string };

let requestCounter = 0;

export function applyAllianceRequest(
  state: AllianceState,
  requesterSchoolId: string,
  recipientSchoolId: string,
  now: number = Date.now(),
): { nextState: AllianceState; result: AllianceActionResult } {
  if (state.simulateRequestFailure) {
    return {
      nextState: state,
      result: { success: false, error: '네트워크 연결 오류로 연합 신청에 실패했습니다.' },
    };
  }

  if (!isValidSchoolId(requesterSchoolId) || !isValidSchoolId(recipientSchoolId)) {
    return {
      nextState: state,
      result: { success: false, error: '유효하지 않은 학교 ID입니다.' },
    };
  }

  if (requesterSchoolId === recipientSchoolId) {
    return {
      nextState: state,
      result: { success: false, error: '자기 학교에는 연합을 신청할 수 없습니다.' },
    };
  }

  // P2-1: 두 학교가 이미 같은 연합에 소속되어 있는지 검사
  const areAlreadyAllied = state.alliances.some(
    (a) => a.schoolIds.includes(requesterSchoolId) && a.schoolIds.includes(recipientSchoolId),
  );
  if (areAlreadyAllied) {
    return {
      nextState: state,
      result: { success: false, error: '두 학교는 이미 같은 연합에 소속되어 있습니다.' },
    };
  }

  // P2-2 (목업 한정 단순화): 어느 한 학교라도 이미 연합에 소속되어 있으면 신청 거절
  // ※ 실제 서비스의 복수 연합 소속 또는 기존 연합 가입 정책은 미결정 상태이며, 목업에서는 1개교 1연합 제약을 적용합니다.
  const requesterAlliance = getAllianceForSchool(state.alliances, requesterSchoolId);
  if (requesterAlliance) {
    return {
      nextState: state,
      result: {
        success: false,
        error: `신청 학교는 이미 다른 연합(${requesterAlliance.name})에 소속되어 있습니다 (목업 단일 연합 제약).`,
      },
    };
  }

  const recipientAlliance = getAllianceForSchool(state.alliances, recipientSchoolId);
  if (recipientAlliance) {
    return {
      nextState: state,
      result: {
        success: false,
        error: `대상 학교는 이미 다른 연합(${recipientAlliance.name})에 소속되어 있습니다 (목업 단일 연합 제약).`,
      },
    };
  }

  // 중복 대기 신청 검사: 같은 두 학교 간 이미 pending 상태인 요청이 있는지
  const hasDuplicatePending = state.requests.some(
    (r) =>
      r.status === 'pending' &&
      ((r.requesterSchoolId === requesterSchoolId && r.recipientSchoolId === recipientSchoolId) ||
        (r.requesterSchoolId === recipientSchoolId && r.recipientSchoolId === requesterSchoolId)),
  );

  if (hasDuplicatePending) {
    return {
      nextState: state,
      result: { success: false, error: '이미 대기 중인 연합 신청이 존재합니다.' },
    };
  }

  const newRequest: AllianceRequest = Object.freeze({
    id: `req-${now}-${++requestCounter}`,
    requesterSchoolId,
    recipientSchoolId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  const nextState: AllianceState = Object.freeze({
    ...state,
    requests: Object.freeze([newRequest, ...state.requests]),
  });

  return {
    nextState,
    result: { success: true, request: newRequest },
  };
}

export function cancelAllianceRequest(
  state: AllianceState,
  requestId: string,
  now: number = Date.now(),
): { nextState: AllianceState; result: AllianceActionResult } {
  const target = state.requests.find((r) => r.id === requestId);
  if (!target) {
    return { nextState: state, result: { success: false, error: '존재하지 않는 요청입니다.' } };
  }

  if (target.status !== 'pending') {
    return { nextState: state, result: { success: false, error: '이미 처리된 요청입니다.' } };
  }

  const updatedRequests = state.requests.map((r) =>
    r.id === requestId ? Object.freeze({ ...r, status: 'cancelled' as const, updatedAt: now }) : r,
  );

  return {
    nextState: Object.freeze({ ...state, requests: Object.freeze(updatedRequests) }),
    result: { success: true },
  };
}

export function demoAcceptAllianceRequest(
  state: AllianceState,
  requestId: string,
  now: number = Date.now(),
): { nextState: AllianceState; result: AllianceActionResult } {
  const target = state.requests.find((r) => r.id === requestId);
  if (!target) {
    return { nextState: state, result: { success: false, error: '존재하지 않는 요청입니다.' } };
  }

  if (target.status !== 'pending') {
    return { nextState: state, result: { success: false, error: '이미 처리된 요청입니다.' } };
  }

  // P2-1 & P2-2: 수락 시점에 최신 상태를 기준으로 전체 유효성 재검증
  if (!isValidSchoolId(target.requesterSchoolId) || !isValidSchoolId(target.recipientSchoolId)) {
    return { nextState: state, result: { success: false, error: '유효하지 않은 학교 ID입니다.' } };
  }

  if (target.requesterSchoolId === target.recipientSchoolId) {
    return { nextState: state, result: { success: false, error: '자기 학교 간 연합은 불가능합니다.' } };
  }

  const areAlreadyAllied = state.alliances.some(
    (a) => a.schoolIds.includes(target.requesterSchoolId) && a.schoolIds.includes(target.recipientSchoolId),
  );
  if (areAlreadyAllied) {
    return { nextState: state, result: { success: false, error: '두 학교는 이미 같은 연합에 소속되어 있습니다.' } };
  }

  // 목업 단일 연합 제약: 신청 학교 또는 수락 학교가 이미 다른 연합에 소속되어 있으면 수락 거절
  const requesterAlliance = getAllianceForSchool(state.alliances, target.requesterSchoolId);
  if (requesterAlliance) {
    return {
      nextState: state,
      result: {
        success: false,
        error: `수락 불가: 신청 학교가 이미 다른 연합(${requesterAlliance.name})에 소속되어 있습니다 (목업 단일 연합 제약).`,
      },
    };
  }

  const recipientAlliance = getAllianceForSchool(state.alliances, target.recipientSchoolId);
  if (recipientAlliance) {
    return {
      nextState: state,
      result: {
        success: false,
        error: `수락 불가: 대상 학교가 이미 다른 연합(${recipientAlliance.name})에 소속되어 있습니다 (목업 단일 연합 제약).`,
      },
    };
  }

  const newAllianceId = `alliance-${target.requesterSchoolId}-${target.recipientSchoolId}`;
  if (state.alliances.some((a) => a.id === newAllianceId)) {
    return {
      nextState: state,
      result: { success: false, error: '이미 동일한 ID를 가진 연합이 존재합니다.' },
    };
  }

  const updatedRequests = state.requests.map((r) =>
    r.id === requestId ? Object.freeze({ ...r, status: 'accepted' as const, updatedAt: now }) : r,
  );

  const reqSchool = getSchoolInfo(target.requesterSchoolId);
  const recSchool = getSchoolInfo(target.recipientSchoolId);

  const newAlliance: Alliance = Object.freeze({
    id: newAllianceId,
    name: `${reqSchool.shortName}·${recSchool.shortName} 연합`,
    schoolIds: Object.freeze([target.requesterSchoolId, target.recipientSchoolId]),
    createdAt: now,
  });

  return {
    nextState: Object.freeze({
      ...state,
      alliances: Object.freeze([newAlliance, ...state.alliances]),
      requests: Object.freeze(updatedRequests),
    }),
    result: { success: true, alliance: newAlliance },
  };
}

export function demoRejectAllianceRequest(
  state: AllianceState,
  requestId: string,
  now: number = Date.now(),
): { nextState: AllianceState; result: AllianceActionResult } {
  const target = state.requests.find((r) => r.id === requestId);
  if (!target) {
    return { nextState: state, result: { success: false, error: '존재하지 않는 요청입니다.' } };
  }

  if (target.status !== 'pending') {
    return { nextState: state, result: { success: false, error: '이미 처리된 요청입니다.' } };
  }

  const updatedRequests = state.requests.map((r) =>
    r.id === requestId ? Object.freeze({ ...r, status: 'rejected' as const, updatedAt: now }) : r,
  );

  return {
    nextState: Object.freeze({ ...state, requests: Object.freeze(updatedRequests) }),
    result: { success: true },
  };
}
