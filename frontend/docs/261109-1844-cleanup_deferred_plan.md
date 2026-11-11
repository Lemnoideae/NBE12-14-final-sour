# 코드·문서 정리 (M1-D5, M1-D6, M1-D7, M5 #1, #4, #6) 계획·결과

Last updated: 2026-11-09 18:44 +0900

- 브랜치: `chore/cleanup-deferred` (main `847a2cc` 기준)
- 지시: 사용자 "좋아, 4번 코드·문서 정리 묶음 진행해줘." (2026-11-09). 묶음 범위는 이연 정리 답변의 4번이다.
- 이연 출처: `.agent-workflow/261108-1951-m1-school-map/deferred.md`, `.agent-workflow/261108-2109-m5-failure-retry/deferred.md`

## 1. 기준

| 출처 | 내용 | 구분 |
|---|---|---|
| 기획서 4-1 #7 (`docs/4차-프로젝트-기획서(261107).html`, 4-1) | 모든 학교의 로고 출력(필수). 로고 출처가 두 곳이면 지도와 이미지 화면이 달라질 수 있다 | M1-D5의 기준 |
| 팀장 추가 요청 N1 (`docs/261107-1233-team_lead_scope_update_plan.md` N1 완료 기준) | 대상 ID별 이미지 일치, 두 사용자 컨텍스트 전파, 대체 표시와 기본 로고 출처 구분 | 사용자 지시로 추가된 범위. M1-D7의 기준 |
| M5 계획 (`docs/261108-2051-m5_failure_retry_click_guard_plan.md`) | 클릭 간격 규칙(`MOCK_CLICK_RULES`, 목업 값)과 실패 시연 | M5 #1·#4·#6의 기준 |

동작과 화면 범위는 바꾸지 않는다. 테스트 의미, 코드 정리, 문구만 다룬다.

## 2. 수정

| ID | 수정 전 | 수정 |
|---|---|---|
| M1-D5 | `SharedImage`가 별도 `DEFAULT_SCHOOL_LOGOS`(빈 객체)를 읽었고, 지도의 로고 상태는 `SCHOOL_LOGO_ASSETS`를 읽었다 | `DEFAULT_SCHOOL_LOGOS`를 지우고 `SharedImage`가 `SCHOOL_LOGO_ASSETS`를 읽는다(`src/components/SharedImage.tsx:71`). 다른 참조는 없었다(`rg DEFAULT_SCHOOL_LOGOS`) |
| M1-D6 | 비교 화면 제목 "SCREEN 1 — 전국 지도 (National View, 전체 활성)"이 권역 칩을 바꿔도 그대로였다 | 제목을 시작 화면으로 표기했다: "SCREEN 1 — 전국 지도 시작 화면 (National View, 처음엔 전체 활성)", SCREEN 2도 같은 방식(`src/components/TwoPhoneMapComparison.tsx`) |
| M1-D7 | N1 완료 기준 체크박스 3개가 비어 있었다 | 목업 검증 근거(테스트 위치)를 붙여 체크했다. 화면 이동 후 유지, 서비스 연동 기준 두 항목은 비워 둔다 |
| M5 #1 | 통합 테스트가 같은 시각에 20회 클릭해 대부분 간격 규칙에 거절됐고, 결과를 확인하지 않았다 | `Date.now`를 100ms씩 앞당기고 치명타 확률(`Math.random`)을 고정해, 20회 모두 기여 점수에 반영되는지 확인한다(`tests/integration.test.ts`) |
| M5 #4 | `MockLoadGate`로 감싼 JSX 네 곳이 다시 들여쓰기되지 않았다 | 네 곳을 들여썼다. `git diff -w`로는 #6의 문구 줄만 바뀐다 |
| M5 #6 | 메뉴의 `aria-label` "시안 비교·시연 도구"와 보이는 제목 "[시연] 시안 비교·도구"가 달랐다 | `aria-label`을 보이는 제목과 같게 했다(`src/App.tsx:325`). 테스트가 두 문구가 같은지 확인한다(`tests/failureRetry.test.ts:253`) |

### 판단 (에이전트)

- M1-D6: 제목을 현재 권역으로 계산하는 방법도 있지만, 비교 화면의 폰은 권역 상태를 안에서 갖고 있어 상태를 위로 올려야 한다. 시연 도구의 문구 결함이라 문구 수정으로 끝냈다.
- M1-D7: 두 번째 항목의 "두 사용자 컨텍스트"는 목업에서 한 저장소를 공유하는 두 열람 화면으로 검증했다. 별도 세션 간 전파는 같은 절의 서비스 연동 기준에 남겨 두었다.

목업 한정: 클릭 간격 규칙(30ms, 1초 20회, 3초 차단)과 치명타 25%는 목업 값이다. 실제 서비스의 클릭 판정은 서버 몫이다(M5 이연 #2).

## 3. 센서와 완료 기준

| # | 기준 | 센서 | 결과 |
|---|---|---|---|
| 1 | 학교 로고를 한 곳에 등록하면 지도 로고 상태와 `SharedImage`가 같이 바뀐다 | `tests/gameUi.test.ts:477` (신규) | 통과. 수정 전 `SharedImage.tsx`로 되돌리면 실패함을 확인 |
| 2 | 간격을 둔 20회 클릭이 모두 기여 점수에 반영된다 | `tests/integration.test.ts` | 통과(3회 반복). 간격을 0으로 바꾸면 기대 600, 실제 30으로 실패함을 확인 |
| 3 | 시연 메뉴의 접근성 이름이 보이는 제목과 같다 | `tests/failureRetry.test.ts:253` | 통과 |
| 4 | 들여쓰기 외 App 동작 변화 없음 | `git diff -w src/App.tsx`, 전체 테스트, 브라우저 센서 | 문구 1줄만 다름 |

### Verified (2026-11-09)

- `npm test` 276개 통과(신규 1개), `npm run lint` 통과, `npm run build` 통과, `git diff --check` 통과
- `node tests/e2e/touch-targets.mjs` 54개 상태 0개 미달, `node tests/e2e/mobile-qa.mjs` 통과

### Not verified

- 실제 로고 자산을 넣은 화면. 자산이 아직 없어(`src/data/schoolLogos.ts`) 테스트에서 임시 URL로만 확인
- 비교 화면 제목 변경의 캡처. 문구만 바뀌었다
- 스크린 리더로 메뉴 이름을 읽는 실제 동작. jsdom 접근성 이름으로만 확인

## 4. 새 이연

없음.
