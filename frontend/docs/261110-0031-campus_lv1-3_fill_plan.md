# 캠퍼스 Lv.1~3 오브젝트 보강 계획

Last updated: 2026-11-10 01:00 +0900

- 상태: **G4 등록·L1~L3 배치 초안 완료, 사용자 확인 대기(2026-11-10 01:00, 9절)**. 8절 결정은 2026-11-10 00:34 승인. 브랜치 `feat/campus-lv1-3-fill`(main `ad55bd9`에서 분기).
- 작업 폴더(촬영·요청서): `.agent-workflow/261109-1950-campus-lead-feedback/`. Lv.4~10 작업과 같은 촬영 도구(`quick.mjs`)와 Pi 요청 형식을 쓴다.
- 관련 문서: `docs/261109-1950-campus_lead_feedback_plan.md`(Lv.4~10, Q5·Q6 결정, 검증 규칙).

## 1. 근거와 범위

| 구분 | 내용 | 출처 |
|---|---|---|
| 기획서 | UI 디자인은 "캠퍼스 느낌이 나게", 성장은 "1단계, 2단계, ~ 10단계". 단계별 오브젝트 구성은 기획서에 정해져 있지 않다 | `docs/4차-프로젝트-기획서(261107).html:901,905` |
| 단계 정의(현재 구현) | Lv.1 풀밭 부지와 텐트(빈 풀밭 부지·나무 푯말·임시 본부 텐트), Lv.2 작은 벽돌 교사와 묘목(단층 벽돌 건물·흙길·어린 묘목), Lv.3 확장된 벽돌 교사와 숲길(확장된 교사·다져진 흙길·자라나는 나무) | `src/data/gameRules.ts:37-39` |
| 사용자 지시(2026-11-10) | Lv.1~3에 오브젝트를 추가하는 계획을 세운다. 어울리는 새 오브젝트는 계획에 넣어도 되며, herdr로 Pi에게 영어로 이미지 생성을 요청할 수 있다 | 이 대화 |
| 이전 결정(유지) | Q5: 기존 에셋을 먼저 쓰고 필요할 때 새로 생성. 이미지 요청은 영어, Pi(herdr) 경유 | `docs/261109-1950-campus_lead_feedback_plan.md` 3-1절 |

이 작업은 기획서 4-1 필수 기능이 아니라 목업의 시각 품질 보강이다. 단계 이름·대표 요소(`features`)는 바꾸지 않는다. 대표 요소는 화면에 60% 이상 보여야 한다는 기존 검증 규칙(`FEATURE_MIN_VISIBLE`)을 계속 지킨다.

## 2. 현재 상태 (촬영 확인, `lv123-before-all.png`)

| 레벨 | 지금 있는 것 | 빈 곳 |
|---|---|---|
| Lv.1 | 텐트, 나무 푯말, 덤불·꽃·돌 9개 | 화면 대부분이 빈 잔디. "부지"라는 느낌을 주는 표시(측량 말뚝 등)가 없음 |
| Lv.2 | 단층 교사, 흙마당, 묘목 4그루, 삽, 참나무 2그루 | 마당 바깥으로 이어지는 길이 없음. 사람이 없음. 공사가 막 끝난 흔적이 삽 하나뿐 |
| Lv.3 | 확장 교사, 흙길 4갈래, 참나무 8그루, 생울타리 2개, 묘목 2그루 | 길에 벤치·조명·표지가 없음. 사람이 없음. 숲 아래쪽이 단조로움 |

성장 시트(`src/assets/images/campus_growth_5x2_final_1793921090067.jpg`)의 Lv.1~3도 구성 요소가 적다. 지금 장면은 시트와 거의 같다. 따라서 이번 보강은 시트 재현이 아니라 **단계 사이의 이야기(개척 캠프 → 첫 교사 → 작은 학교 마을)를 소품으로 보여 주는 것**을 목표로 한다(에이전트 권고).

## 3. 원칙 (에이전트 권고)

1. **성장 순서를 지킨다.** Lv.1~3은 나무·흙·손수레처럼 소박한 재료만 쓴다. 철제 가로등, 분수, 포장길, 화려한 화단은 Lv.4 이후에 남겨 둔다. Lv.3이 Lv.4보다 화려해 보이면 안 된다.
2. **Lv.1은 "빈 부지"를 남긴다.** 소품은 텐트 주변의 캠프 한 무리와 부지 표시에만 둔다. 화면 가운데 잔디는 비워 둔다.
3. **다음 단계를 예고한다.** Lv.1의 측량 말뚝은 Lv.2 교사 자리를, Lv.2의 쌓인 벽돌·목재는 Lv.3 확장을 예고한다.
4. **앞 단계 소품을 조금 이어 쓴다.** 나무 푯말은 Lv.2에서 학교 이름판처럼 마당 입구에 남긴다(누적 원칙 Q6의 확장 적용. 8절 D2로 승인).
5. **기존 규칙을 그대로 통과한다.** 길 연결, 정문의 길, 길 위 소품 금지, UI(방명록·라벨·터치 힌트)에 가린 대표 요소 금지.

## 4. 레벨별 계획

표의 "새"는 5절의 새 에셋(G4)이다. 나머지는 기존 에셋이다.

### 4-1. Lv.1 개척 캠프

| 영역 | 오브젝트 | 비고 |
|---|---|---|
| 텐트 앞 | 모닥불(새) 1, 통나무 의자(새) 1~2, 앉은 학생 2 | 밤에 모닥불 빛(`glows`). 기존 텐트 등불 빛은 유지 |
| 텐트 옆 | 보급품 나무 상자 더미(새) 1, 목재 더미(새) 1 | 텐트를 가리지 않게 텐트 뒤·옆 |
| 화면 가운데 | 측량 말뚝과 줄(새) 4개로 Lv.2 교사 자리를 사각형으로 표시 | 잔디는 그대로 비워 둔다 |
| 가장자리 | 덤불·꽃 재배치, 어린 나무 1~2(기존 `sapling`), 강아지 1(기존 `dog`) | 기존 `scatter` 9개 중 일부를 옮긴다 |

### 4-2. Lv.2 첫 교사

| 영역 | 오브젝트 | 비고 |
|---|---|---|
| 정문 앞 | 흙길 한 줄을 마당에서 화면 아래 가장자리까지(기존 `tex-dirt`) | "흙길" 대표 요소 강화. 정문 길 규칙도 만족 |
| 마당 입구 | 나무 푯말(Lv.1에서 이어 옴), 나무 랜턴 기둥(새) 1~2 | 랜턴은 밤에 빛남 |
| 교사 옆 | 종 걸이(새) 1 | 첫 학교의 상징 |
| 마당 모서리 | 벽돌 실은 손수레(새) 1, 목재 더미(새, Lv.1과 같은 에셋) 1 | 공사가 막 끝난 흔적. 삽은 손수레 옆으로 |
| 묘목 옆 | 물뿌리개(새) 1 | 묘목 4그루 중 하나 옆 |
| 마당 가장자리 | 흰 나무 울타리(기존 `fence-picket`) 2~3구간 | 마당 경계. 길이 지나는 곳은 비운다 |
| 사람 | 걷는 학생 3~4 | 기존 `student-*` |

### 4-3. Lv.3 숲길 학교 마을

| 영역 | 오브젝트 | 비고 |
|---|---|---|
| 흙길 갈림길 | 나무 게시판(새) 1 | 길 옆 잔디 |
| 흙길 양옆 | 나무 랜턴 기둥(새) 3~4, 통나무 벤치(새) 2 | 철제 가로등(`lamp`)은 Lv.4 이후용으로 남긴다 |
| 숲 | 새집 기둥(새) 1, 통나무 의자, 덤불·꽃 | 아래쪽 숲 사이 |
| 교사 앞 | 기존 생울타리 유지, 꽃(기존 `flowers-*`) 2 | |
| 사람·생활 | 걷는 학생 6~8, 자전거 1(기존 `bicycle`), 피크닉 매트 1(기존) | 학생이 늘어 학교다워진 느낌 |

## 5. 새 에셋 G4 (Pi 생성, 사용자 확인 후 요청)

Lv.4~10의 G2와 같은 방식으로 요청한다. 6개 소품 시트 2종을 각각 후보 2장씩, 모두 4회 호출한다. 에이전트가 후보를 고르고 `scripts/assets/manifest.json`의 `box`로 잘라 1x·HD로 등록한다.

| 시트 | 칸 | 용도 |
|---|---|---|
| G4-A 개척·공사 소품 | 모닥불, 보급품 상자 더미, 목재 더미, 벽돌 손수레, 측량 말뚝, 물뿌리개 | Lv.1~2 |
| G4-B 초기 캠퍼스 소품 | 나무 랜턴 기둥, 나무 게시판, 통나무 벤치, 종 걸이, 새집 기둥, 통나무 의자 | Lv.2~3 |

G2에서 겪은 문제를 프롬프트에 반영했다. 당시 3×3 시트가 나왔고 긴 소품의 방향이 반대였으며 칸이 고르지 않았다. 그래서 이번에는 "정확히 6개", "각 칸 가운데", 긴 소품이 없는 구성으로 요청하고, 가르기는 `box`로 처리한다. 측량 말뚝은 긴 줄 대신 말뚝 하나와 짧은 줄 끝으로 만들어, 놓는 방향 문제를 피한다.

호출 4회(모두 `image_size: 2K`, `aspect_ratio: 1:1`). 참고 이미지: `generated-images/20261107-225318-a1a-c3-clocktower-2k.png`(스타일 기준), `generated-images/20261107-234720-a4-s3-props-3x3.png`(기존 소품 크기 기준), 성장 시트.

G4-A(호출 1·2, 배경 마젠타):

```
A sprite sheet of exactly 6 separate small game objects arranged in a grid of 2 rows and 3 columns, each object centered in its own equal cell with wide empty margin, no object touching or overlapping another cell, no extra objects. Top row, left to right: a small campfire of crossed logs inside a ring of grey stones with a few orange flames; a stack of three wooden supply crates with rope handles; a neat pile of cut wooden planks and logs. Bottom row, left to right: a wooden wheelbarrow loaded with red bricks; one wooden survey stake with a red ribbon tied to its top and a short piece of white string at its base; a small green metal watering can. All objects share the same scale and camera angle as the small props in the second reference image, small enough to stand next to a tent. Isometric 2:1 pixel art matching the style of the reference images: cozy university campus, light from the upper left, 1px dark brown outlines, limited palette, crisp hard-edged pixels with no anti-aliasing and no blur. Same camera angle and pixel density as the reference clock tower building. Absolutely no shadows of any kind: no cast shadow, no drop shadow, no ground shadow, no dark patch under the object. No ground tile, no grass, no soil base under the object. No text, no labels, no watermark, no grid lines. The background must be one solid flat magenta color #FF00FF filling the whole image, with no gradient, no texture, no vignette, and no other objects.
```

G4-B(호출 3·4, 배경 마젠타):

```
A sprite sheet of exactly 6 separate small game objects arranged in a grid of 2 rows and 3 columns, each object centered in its own equal cell with wide empty margin, no object touching or overlapping another cell, no extra objects. Top row, left to right: a tall wooden lantern post, a single dark wooden pole with a small hanging iron oil lantern with yellow glass near its top; a small wooden notice board on two legs with a little roof and a few pinned white papers; a rustic bench made of a split log on two short log legs. Bottom row, left to right: a small bronze school bell hanging in a simple wooden A-frame; a little wooden birdhouse with a red roof on a thin wooden pole; a short round tree-stump stool. All objects share the same scale and camera angle as the small props in the second reference image; the lantern post is about as tall as a person and a half. Isometric 2:1 pixel art matching the style of the reference images: cozy university campus, light from the upper left, 1px dark brown outlines, limited palette, crisp hard-edged pixels with no anti-aliasing and no blur. Same camera angle and pixel density as the reference clock tower building. Absolutely no shadows of any kind: no cast shadow, no drop shadow, no ground shadow, no dark patch under the object. No ground tile, no grass, no soil base under the object. No text, no labels, no watermark, no grid lines. The background must be one solid flat magenta color #FF00FF filling the whole image, with no gradient, no texture, no vignette, and no other objects.
```

새 에셋 ID(안): `campfire`, `crates`, `lumber`, `wheelbarrow`, `survey-stake`, `watering-can`, `lantern-post`, `notice-board`, `log-bench`, `school-bell`, `birdhouse`, `stump`.

## 6. 코드 변경 (에이전트 권고)

| 위치 | 변경 |
|---|---|
| `src/data/campusLayouts.ts` `OFF_PATH_PROP` | 새 소품 중 길 위에 서면 안 되는 것(상자·목재·손수레·벤치·게시판·종 걸이·새집·그루터기·모닥불)을 추가 |
| `src/components/CampusScene.tsx` `LAMP_ASSETS` | `lantern-post`를 추가해 밤에 등불이 켜지게 함. 빛 위치는 등불 높이에 맞게 조정 필요(촬영 확인) |
| 레벨 데이터 `glows` | Lv.1 모닥불 빛 추가 |
| `tests/campusScene.test.ts` | 레벨별 회귀 검사: Lv.1 캠프 소품과 비어 있는 가운데 잔디, Lv.2 흙길이 화면 가장자리까지 이어짐과 정문 연결, Lv.3 길가 랜턴·벤치. 새 램프 에셋이 밤 빛 목록에 들어가는지 |
| `tests/campusAssets.test.ts` | 새 에셋은 기존 검사(크기·배경 제거·HD 크기)를 그대로 받는다 |

## 7. 단계와 완료 기준

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **G4** | 5절 요청서를 `requests/G4-a1.md`로 쓰고 herdr로 Pi(`wK:p5`)에 전달. 후보를 골라 등록 | ack·결과 파일 확인, 배경 제거·잘림 없음(화면 확인), `tests/campusAssets.test.ts` 통과 |
| **L1** | 4-1 | lint·test·build 통과, Lv.1 낮·밤·디버그 전후 촬영, 가운데 잔디가 비어 보이는지 확인(D3), 사용자 확인 후 커밋 |
| **L2** | 4-2 | 같음 + 흙길이 정문과 화면 가장자리를 잇는다 |
| **L3** | 4-3 | 같음 + Lv.3이 Lv.4보다 화려해 보이지 않는지 Lv.4와 나란히 놓고 사용자 확인 |

순서: G4 요청 → (생성 기다리는 동안 기존 에셋만으로 L1~L3 배치 초안) → G4 등록 → L1 → L2 → L3. 단계마다 기존 절차(전후 촬영, lint·test·build, 보고, 사용자 확인, 지시가 있을 때만 커밋)를 따른다. 결함은 AGENTS.md 위험도 기준으로 분류하고 이연 항목은 작업 폴더의 `deferred.md`에 남긴다.

## 8. 사용자 결정 (2026-11-10)

사용자 지시: "권고 사항을 계획서에 전부 반영해줘." 아래 에이전트 권고를 모두 승인된 결정으로 적용한다.

| # | 질문 | 결정(에이전트 권고 승인) | 반영 위치 |
|---|---|---|---|
| D1 | 새 에셋 12종(5절)을 모두 생성할지, 일부만 생성할지 | 모두 생성. 호출 4회로 끝나고, 쓰지 않는 칸은 등록하지 않는다 | 5절, 7절 G4 |
| D2 | Lv.1의 나무 푯말을 Lv.2 마당 입구에 이어 둘지 | 이어 둔다(성장 이야기 연결) | 3절 원칙 4, 4-2 |
| D3 | Lv.1 측량 말뚝으로 Lv.2 교사 자리를 미리 표시할지 | 표시한다(말뚝 4개). 촬영에서 "빈 풀밭 부지" 느낌이 약해지면 말뚝을 2개로 줄인다 | 4-1, 7절 L1 |
| D4 | Lv.3 길가 조명을 철제 가로등 대신 나무 랜턴 기둥으로 할지 | 나무 랜턴 기둥. 철제 가로등은 Lv.6의 대표 요소("빈티지 가로등", `src/data/gameRules.ts:42`)라서 앞당기지 않는다 | 4-3, 6절 `LAMP_ASSETS` |
| D5 | 이전 Q5처럼 기존 에셋만으로 먼저 배치할지 | 생성과 배치 초안을 함께 진행한다. Lv.1~3에 맞는 소박한 기존 소품이 삽·푯말·텐트 정도뿐이라 기존 에셋만으로는 보강 폭이 작다(추론) | 7절 순서 |

## 9. 진행 기록 (2026-11-10)

사용자 지시(2026-11-10): "계획서에 적힌 작업들을 시작해줘." G4와 L1~L3 배치 초안을 진행했다. 커밋은 하지 않았다(사용자 확인 대기).

### 9-1. G4 생성·등록

- 요청서 `.agent-workflow/261109-1950-campus-lead-feedback/requests/G4-a1.md`, 결과 `results/G4-a1.json`(status `PARTIAL`).
- 호출 1: 3×3(9개)로 나와 제외. 호출 2(`generated-images/20261110-004003-g4-c2-camp-2x3-b.png`): 6개, 2×3, 채택. 호출 3(`generated-images/20261110-004117-g4-c3-early-2x3-a.png`): 6개, 2×3, 채택. 호출 4: 서버 오류로 재시도 2회까지 실패(결과 파일의 기록). 호출 3이 요구를 충족해 재요청하지 않았다.
- 12종을 `scripts/assets/manifest.json`에 `box` 자르기로 등록하고 1x·HD(3x·6x)를 만들었다. 학생(12px) 옆에서 비교해 상자·목재·통나무 벤치·물뿌리개·그루터기 크기를 줄였다(에이전트 판단, 촬영 확인).

### 9-2. 코드

- `src/data/campusLayouts.ts`: 새 소품을 `OFF_PATH_PROP`에 추가. 램프 빛 위치를 `LAMP_LIGHTS`·`lampGlows`로 옮겨 `lantern-post`는 기둥 꼭대기가 아니라 팔에 걸린 등불(스프라이트 위에서 9.5px, 오른쪽 1.5px)에서 빛나고 좌우 반전을 따른다. 램프 간격 검사에 `lantern-post`를 포함.
- `src/components/CampusScene.tsx`: `LAMP_ASSETS` 대신 `lampGlows` 사용.
- Lv.1~3 배치(4절). 회귀 테스트 5개를 `tests/campusScene.test.ts`에 추가: 랜턴 빛 위치·반전, Lv.1~3에 철제 램프·포장·분수·철제 벤치 없음, Lv.1 캠프와 빈 부지, Lv.2 흙길이 화면 밖까지 이어짐, Lv.3 길가 랜턴·벤치·게시판.

### 9-3. 계획과 달라진 점 (에이전트 판단, 사용자 확인 필요)

| 항목 | 계획 | 실제 | 이유 |
|---|---|---|---|
| Lv.2 흰 울타리 | `fence-picket` 2~3구간 | 넣지 않음 | camera 2에서 울타리가 학생보다 크고 흰색이 화면을 압도했다(촬영 확인) |
| Lv.1 측량 줄 | 말뚝 4개와 줄 | 말뚝 4개만 | 줄을 그릴 에셋·그리기 기능이 없다. 말뚝의 짧은 끈만 보인다 |
| Lv.1 측량 위치 | Lv.2 교사 자리 | 교사 자리보다 왼쪽 위 | 정확한 자리는 텐트와 겹친다 |
| Lv.3 랜턴 | 3~4개 | 3개 | 왼쪽 길 끝과 교사 뒤 자리는 나무·교사에 가려 빛만 떠 보였다(밤 촬영 확인) |
| Lv.3 교사 앞 꽃 | 2개 | 1개 | 두 번째 자리가 모두 길 위였다(검증 규칙) |
| Lv.3 통나무 의자 | 숲 속 | 그루터기 1개 | 같은 역할의 새 에셋 `stump` 사용 |

### 9-4. 확인

- 촬영: `.agent-workflow/261109-1950-campus-lead-feedback/lv123-after/`(낮·밤·디버그, `day-all.png`, `night-all.png`). 전 촬영은 `lv123-before/`.
- `npm run lint` 통과, `npm test` 321개 통과, `npm run build` 성공.
- 남은 일: L1~L3 사용자 확인, 커밋. 계획 7절은 단계마다 확인·커밋으로 되어 있으나 이번에는 세 레벨을 한 번에 진행했다.
