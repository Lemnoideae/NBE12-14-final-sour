# 한양대 고정값 정리와 터치 영역 44px

Last updated: 2026-11-09 14:18 +0900

- **지시:** 사용자 지시(2026-11-09 “한양대 고정값 정리 및 터치 범위 44px로 확대 작업을 진행해줘.”). Issue #15 [누적 이연 정리 댓글](https://github.com/Lemnoideae/261106-mkup/issues/15#issuecomment-6732554824)의 “한양대·가상 학교 고정값” 묶음과 미등록 항목 “터치 영역 44px”이다.
- **브랜치:** `feat/school-fixed-values-touch-44` (기준 `main` `c2317fa`).

## 1. 요구 출처 구분

| 구분 | 내용 | 근거 |
|---|---|---|
| 기획서 필수 | 이메일 인증으로 정한 소속 학교 기준의 클릭·순위·방문. 소속 학교와 다른 학교 표시가 섞이면 안 된다 | `docs/4차-프로젝트-기획서(261107).html` §4-1, §4-3 시나리오 1·2 |
| 기획서 선택 | 타 학교 방명록(닉네임 + 학교 이름 표시) | 같은 기획서 §4-2 #4 |
| 이전 승인 | 내 학교는 M4에서 이메일 인증으로 정한다. 기본 시작 학교는 한양대 샘플 | `docs/261108-2020-m4_onboarding_auth_plan.md` |
| 사용자 지시(이번) | 터치 영역은 **보이는 모양을 유지하고 터치 영역만 44×44px로 확대**. 이웃과 겹치는 곳만 간격·높이 조정, 입력란은 높이 44px. **[시연] 도구·시안 비교 화면과 지도 학교 마커는 제외** | 2026-11-09 질의 응답 |
| 기획서에 없음 | 44px 수치는 기획서 요구가 아니라 사용자 지시다. 기존 문서는 44pt(Apple HIG)·24px(WCAG 2.2 SC 2.5.8)을 미검증 기억으로 적었다(`docs/261108-1122-main_screen_layout_plan.md:99`) | — |

## 2. 한양대 고정값 묶음

| ID | 위치 | 내용 | 처리 |
|---|---|---|---|
| M2-D1, M4-3 | `src/components/GuestbookBottomSheet.tsx:43`–, `VisitingScreen1Phone.tsx:169`–`:212`, `VisitingSchoolPhone.tsx` | 방문 방명록 샘플이 바다 학교 문구이고, 기본 닉네임 “클릭장인(한양대학교)”이 쓴 글처럼 보이며, 방문한 학교 학생이 자기 학교 방명록에 쓴 글이 나온다 | 학교 ID 기반 샘플 데이터 모듈로 옮기고, 학교 중립 문구로 바꾼다. 방문 학교 소속 글은 제외한다. 미리보기와 전체 목록이 같은 데이터를 쓴다 |
| M2-D4 | `src/components/TwoPhoneVisitingComparison.tsx:79` | 시안 캡션이 바다 학교 문구를 설명 | 새 샘플에 맞춰 문구 수정 |
| M4-1 | `src/components/ChatScreen2Phone.tsx:79` | `mySchoolInitial="한"` 고정 | 소속 학교 값 사용 |
| M4-2 | `src/components/OurSchoolGuestbookScreen2Phone.tsx:83` | `schoolName="한양대학교"` 고정 | 소속 학교 값 사용 |
| 추가 발견 | `OurSchoolGuestbookBottomSheet.tsx` | 우리 학교 방명록 샘플에 소속 학교 학생 글(예: KAIST 입학 시 KAIST 글)이 섞이고 “7위 축하! 근데 2위는 우리 거”가 실제 순위와 무관 | 소속 학교 글 제외, 순위 고정 문구 제거 |
| M6-D4 | `OurSchoolGuestbookBottomSheet.tsx:192` | “방명록 52개”와 실제 목록 수 불일치 | 실제 목록 수 표시 |
| 추가 발견 | `TopHUD`, `ChatBottomSheet`, `GuestbookBottomSheet`, `OurSchoolGuestbookBottomSheet`의 기본 prop | `'한양대학교'`·`'한'`·`'클릭장인'` 기본값 | 기본값을 없애고 호출부가 소속 학교 값을 넘기게 한다(타입 검사로 누락 방지) |
| M4-4 | `src/components/ShopScreenPhone.tsx:238` | “한빛 잡화점 & 강화소” | 학교 중립 이름으로 변경. `pixel_crest_hanbit` 자산은 이미 없다(`rg hanbit src` 0건) |
| M4-6 | `src/data/mockRankings.ts:65` | 모든 학교가 같은 샘플 학생 닉네임 8개 | **허용(에이전트 권고):** 닉네임은 학교와 무관하고, 학과는 이미 학교별로 바꾼다(`:94`). 목업 샘플 재사용으로 기록 |
| M4-7 | `src/App.tsx:45`, `:697` | 시연 학교명 선택 시 배지가 이름 첫 글자 | **허용(에이전트 권고):** 시연 이름(예: 서울과학기술대학교)의 첫 글자와 일치한다. 기본값은 소속 학교 배지 |

범위 밖: `MY_SCHOOL_ID = 'hanyang'`(기본 시작 학교), 인증 샘플 도메인 `hanyang.ac.kr`, 이미지 권한 목업 사용자(`src/hooks/useSharedImages.tsx:26`, 내 사용자는 입학 시 갱신 `src/hooks/useMockGame.tsx:53`), 학과 시드(`src/data/gameRules.ts:89`).

## 3. 터치 영역 44px

### 3-1. 현재 (Chromium 156, 390×844, 서비스 흐름 9개 화면 + 게임 탭 4개)

44px 미만 조작 요소 287개(중복 포함). 지도 마커 다수, 연합 신청 학교 목록 행(304×34), 탭(109×30), 돌아가기(51~62×25~30), 소리(28×28), 이메일 칩(×24), 검색 입력(×24) 등. 측정 스크립트는 세션 scratchpad의 일회성 `audit44.mjs`다.

### 3-2. 방식

- 서비스 화면 영역에 `data-touch-area="44"`를 두고, 그 안의 버튼·링크·탭에 보이지 않는 `::after` 터치 영역을 둔다(가운데 정렬, 최소 44×44). 모양은 바꾸지 않는다.
- 입력란(`input`·`select`·`textarea`)은 가상 요소를 쓸 수 없어 최소 높이 44px로 키운다.
- 이웃과 터치 영역이 겹치거나 상위 `overflow`에 잘리는 곳은 간격·높이를 조정한다.
- 제외: [시연] 도구 패널·서비스 흐름 메뉴, 시안 비교 화면, 지도 학교 마커와 군집 버튼(같은 학교를 지도 목록의 `방문` 버튼으로 고를 수 있다: `src/components/MapParts.tsx:322`).

### 3-3. 센서

- `tests/e2e/touch-targets.mjs`(신규): 서비스 화면·시트의 조작 요소마다 중심에서 상하좌우 21px 지점을 `elementFromPoint`로 찍어 그 요소가 받는지 확인한다. 제외 대상은 명시적 표시로만 뺀다.
- 화면 회귀: 수정 전후 같은 화면을 캡처해 보이는 모양이 바뀌지 않았는지 비교한다(입력란 높이 변경은 예외로 기록).
- DOM 테스트: 서비스 영역 표시와 제외 표시가 붙는 위치를 고정한다.

## 4. 완료 기준

1. 다른 학교(KAIST)로 입학했을 때 서비스·시안 화면 어디에도 한양대 고정값이 남지 않는다(DOM 테스트).
2. 방문 방명록에 방문 학교 소속 글이 없고, 미리보기와 전체 목록이 같은 데이터를 쓴다.
3. 우리 학교 방명록에 소속 학교 글이 없고, 개수 표시가 실제 목록 수와 같다.
4. 서비스 화면의 제외 대상이 아닌 모든 조작 요소의 터치 영역이 44×44px 이상이다(Chromium 센서, 세로·가로).
5. `npm test`, `npm run lint`, `npm run build`, `git diff --check` 통과.

## 5. 결과

### 5-1. 한양대 고정값 (커밋 `7575a6b`)

| 항목 | 결과 |
|---|---|
| 방명록 샘플 | `src/data/mockGuestbook.ts`(신규)로 옮겼다. 학교 ID만 적고 이름·첫 글자·배지 색은 공통 학교 목록에서 채운다. 없는 ID는 오류로 막는다. 방문 방명록은 방문 학교 글, 우리 학교 방명록은 소속 학교 글을 뺀다 |
| 방문 미리보기 | `GuestbookPreviewNotes`(`src/components/VisitingParts.tsx`)가 같은 샘플에서 좋아요 상위 2건을 고른다. `VisitingScreen1Phone`·`VisitingSchoolPhone`의 고정 쪽지를 대체 |
| 개수 표시(M6-D4) | `OurSchoolGuestbookBottomSheet` 헤더가 `entries.length`를 표시 |
| 기본 prop | `TopHUD`·`ChatBottomSheet`·`GuestbookBottomSheet`·`OurSchoolGuestbookBottomSheet`의 한양대 기본값을 없애고 필수 prop으로 바꿨다. 시안 화면 4개는 `useMySchool()`과 `schoolHudProps()`로 소속 학교 값을 넘긴다. `VisitingSchoolPhone`의 닉네임 “클릭장인”도 플레이어 닉네임으로 바꿨다 |
| 상점 이름(M4-4) | “캠퍼스 잡화점 & 강화소” |
| 캡션(M2-D4) | 방문·우리 방명록 시안 캡션을 새 샘플 규칙으로 고쳤다 |
| 회귀 테스트 | `tests/schoolFixedValues.test.ts`: 샘플 제외 규칙, 미리보기=전체 상위 2건, KAIST 입학 시 실제 시트(이름·소속 글 제외·개수), 우리 방명록·채팅 시안에 “한양” 없음, 방문 시안 작성란 “KAIST · 닉네임” |

### 5-2. 터치 영역 44px

| 항목 | 결과 |
|---|---|
| 서비스 영역 | `src/App.tsx`의 `SERVICE_VIEW_MODES`(게임·온보딩·지도·방문·순위·상점·연합 신청·현재 연합·대결 신청·대결 현황)에서만 `data-touch-area="44"`를 붙인다. 시트(`<dialog>`)도 이 영역 안에 렌더링된다 |
| 규칙 | `src/index.css` `@layer base`: 버튼·링크·탭·체크박스 라벨에 보이지 않는 `::after`(가운데, 최소 44×44), 입력란 `min-height: 44px`. base 층이라 `absolute` 같은 위치 유틸리티가 이긴다 |
| 제외 | `data-no-touch44`: 지도 학교 마커·TOP3 마커·권역 군집, “[시연] 성장 시트 보기”, 연합·대결 화면의 시연 제어 영역 4곳 |
| 간격·높이 조정 | 시트 닫기 막대 24→44px, 지도 검색 입력 44px·권역 칩 간격과 위아래 여백, 지도 목록 펼침 막대 최소 44px, 이메일 샘플 칩 줄 간격, 연합 신청 학교 목록 간격, 대결 현황 필터 여백, 상점 탭 돌아가기 버튼 여백 |
| 센서 | `tests/e2e/touch-targets.mjs`(신규): Chromium에서 조작 요소마다 가운데와 상하좌우 21px 지점을 `elementFromPoint`로 찍는다. 세로 390×844·가로 844×390, 서비스 화면 9개 + 시트 3개 + 게임 탭 4개 + 방문 화면 = 34개 상태 |
| 측정 | 수정 전 첫 실행: 200개 미달(세로·가로 합계). 수정 후: 34개 상태 모두 0개 미달 |
| 화면 비교 | 390×844 서비스 화면 9개를 수정 전후 픽셀 비교. 게임·순위·현재 연합·대결 신청은 0px 차이. 상점은 이름 글자만, 온보딩·지도·연합 신청·대결 현황은 위 간격·높이 조정 영역만 달라졌다 |
| DOM 테스트 | `tests/mobileQa.test.ts`: 서비스 영역 표시, 흐름 메뉴·시안 비교 화면 제외, 모든 지도 마커의 제외 표시, 목록 `방문` 버튼은 대상 |

### 5-3. 완료 기준 대조

| 기준 | 상태 | 근거 |
|---|---|---|
| 1. KAIST 입학 시 한양대 고정값 없음 | 충족(우리 방명록·채팅 시안, 실제 우리 방명록 시트, 방문 시안 작성란) | `tests/schoolFixedValues.test.ts` |
| 2. 방문 방명록에 방문 학교 글 없음, 미리보기=전체 | 충족 | 같은 테스트 1·2·5번 |
| 3. 우리 방명록에 소속 글 없음, 개수=목록 수 | 충족 | 같은 테스트 3번 |
| 4. 서비스 조작 요소 44×44 | 측정한 34개 상태에서 충족 | `node tests/e2e/touch-targets.mjs` (Chromium 156) |
| 5. test·lint·build·diff --check | 통과 | 테스트 269개 통과 |

### 5-4. 남은 일

- 이연 3건(저 2·미 1): `.agent-workflow/261109-1357-school-touch44/deferred.md`. 이전 이연 중 M2-D1·D4, M4 #1~#4, M6-D4는 해소했고 M4 #6·#7은 허용으로 기록했다.
- 측정하지 않은 상태: 인증 코드·프로필 단계, 불러오기 실패 화면, 연합·대결 신청의 선택 후 상태, 지도 목록을 펼친 상태, 360px 폭. 실기기 손가락 터치는 확인하지 않았다.
