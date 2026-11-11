# 캠퍼스 기본 화면을 방식 B로 전환하는 계획

Last updated: 2026-11-08 19:22 +0900

## 1. 배경과 출처

| 구분 | 내용 |
|---|---|
| 사용자 지시 (2026-11-08) | "B를 기본 화면으로 바꾸는 계획 세워줘." |
| 근거 | `docs/261108-0950-campus_hd_asset_plan.md`(Issue [#23](https://github.com/Lemnoideae/261106-mkup/issues/23)로 이동) 8장. B는 A와 거의 같은 화질을 낸다(A 대비 평균 픽셀 차이 0.9~3.2). 레벨당 전송량은 0.5~2.4MB이고, RSS는 C와 같은 수준이다. |
| 기획서 대조 | `docs/4차프로젝트기획서(261106).html` 4-1 필수 기능, 10·11장에는 렌더링 화질·로딩 기준이 없다. 이 작업은 사용자 지시에 따른 화면 품질 개선이며 필수 기능의 선행 조건이 아니다. 6장 인프라(S3 정적 배포)를 고려해 배포 결과물의 용량을 보고한다. |
| 목업 한정 | 측정은 데스크톱 Chromium 에뮬레이션이다. 실제 기기 성능은 검증하지 않았다. |

## 2. 현재 상태 (검증: 코드)

| 항목 | 위치 | 내용 |
|---|---|---|
| 기본 화면 (C) | `src/components/CampusScene.tsx`, `src/hooks/useSharpImages.ts`, `src/utils/sharpResample.ts`, `src/workers/sharpResample.worker.ts` | 1x sprite를 worker에서 정수배로 확대한 뒤 브라우저가 부드럽게 축소한다 |
| 시험 모드 A·B | `src/data/campusAssetModes.ts` | `?campusAssets=raw`·`hd`일 때 `public/campus-*/manifest.json`을 실행 중에 받아 온다. 두 디렉터리는 git에 올라가지 않는다 |
| 1x sprite | `src/assets/campus/` | 화면 좌표계(크기·anchor), footprint 측정(`scripts/assets/footprints.py`), 배치 검증, 에셋 검사(`tests/campusAssets.test.ts`)의 기준이다 |
| 작은 파일 인라인 | Vite 8.3.6 기본값 | 4KB 미만 에셋은 JS 번들에 base64로 들어간다. B 파일 중 39개(88KB)가 여기에 해당한다(`find public/campus-hd -size -4096c`) |

## 3. 결정 사항과 대안

| # | 항목 | 기본안 (에이전트 권고) | 대안과 트레이드오프 |
|---|---|---|---|
| 1 | B 결과물 위치 | `src/assets/campus-hd/{3,6}/`에 두고 커밋한다(약 10.6MB). 원본 `generated-images/`가 커밋되지 않으므로, 다른 환경에서도 빌드되려면 결과물이 저장소에 있어야 한다 | Git LFS: 저장소 크기는 줄지만, 이 저장소에는 LFS 설정이 없어 도입 비용이 든다 |
| 2 | 1x sprite | 유지한다. 좌표계·footprint·배치 검증의 기준이고, B 파일을 불러오지 못할 때 대신 표시한다 | 제거하면 좌표 기준을 B로 옮겨야 한다. 영향 범위가 커서 권하지 않는다 |
| 3 | sharp-bilinear | 제거한다. B가 기본이 되면 쓰는 곳이 없고 worker 청크만 남는다. 측정 근거는 `docs/261108-0223-campus_sharp_resample.md`(Issue [#21](https://github.com/Lemnoideae/261106-mkup/issues/21)로 이동)에 남아 있다 | 유지: B 파일을 불러오지 못할 때 1x를 고르게 그릴 수 있다. 그러나 드문 실패 경로에 worker 코드 약 300줄을 남기게 된다 |
| 4 | 시험 모드 A (`?campusAssets=raw`) | 화면 코드에서 제거하고 `campusAssetModes.ts`를 정리한다. 생성 스크립트의 `--raw`는 원본 확인용으로 남긴다 | 유지: 계속 비교할 수 있지만, 실행 중 목록 로딩 코드와 `public/campus-raw/`(53MB)가 남는다 |
| 5 | 로컬 `public/campus-raw/`, `public/campus-hd/` | `campus-hd`는 `src/assets/`로 옮긴 뒤 삭제한다. `campus-raw`는 `--raw`로 다시 만들 수 있으므로 삭제한다. 두 디렉터리는 git에 올라가지 않으므로 삭제 전에 확인을 받는다 | 남겨 두면 `npm run build`가 64MB를 `dist/`로 복사한다(이연 D2) |
| 6 | 작은 B 파일 인라인 | `vite.config.ts`의 `build.assetsInlineLimit`을 함수로 지정해 `campus-hd`는 인라인하지 않는다. Vite 8.3.6 타입에서 함수 형태를 지원함을 확인했다(`node_modules/vite/dist/node/index.d.ts:2772`) | 기본값 유지: 요청 수는 줄지만 JS 번들이 약 118KB(base64) 커진다. 번들은 이미 500KB 경고를 받고 있다 |

## 4. 수정 계획

### 4-1. 생성 스크립트

- `process.py --hd`의 출력 위치를 `src/assets/campus-hd/`로 바꾼다.
- `src/assets/campus/manifest.json`의 각 sprite에 `hdScales`(예: `[3, 6]`)를 기록한다. 같은 실행에서 1x 크기와 함께 쓰므로, 1x와 B가 서로 다른 시점의 결과가 되지 않는다(이연 D4).
- 실행 순서: 1x를 다시 만든 다음 `--hd`를 실행한다. 1x 크기가 바뀌었는데 `--hd`를 다시 실행하지 않으면 4-4의 테스트가 실패한다.

### 4-2. 에셋 레지스트리 (`src/data/campusAssets.ts`)

- `CampusAsset`에 `hd?: Readonly<Record<number, { url: string; lightsUrl?: string }>>`를 추가한다.
- 1x의 `assetUrl`과 같은 방식(`new URL(..., import.meta.url)`)으로 URL을 만든다. 그러면 Vite가 빌드 때 파일을 포함하므로, 목록을 실행 중에 받아 올 필요가 없다. 이로써 로딩 중 1x가 잠깐 보이는 문제(이연 D3)가 사라진다.
- 배율 선택 함수 `hdScale`은 `src/data/campusAssetModes.ts`에서 이 모듈(또는 `campusGeometry.ts`)로 옮긴다.

### 4-3. 화면 (`src/components/CampusScene.tsx`)

- `SceneImage`는 레이어의 장치 비율로 배율을 고른다. `asset.hd`가 있으면 그 URL을 `image-rendering: auto`로 그리고, 없거나 불러오지 못하면 1x를 `pixelated`로 그린다.
- 제거: `useSharpImages`·`prescaleFactor` 사용, `useCampusAssetMode`, `?campusAssets` 처리(결정 3·4).
- 크기를 재기 전의 처리:
  - 지금은 크기를 재기 전에 6배를 요청한다. 그런데 화면 크기를 재고 나서 3배로 바뀌면 같은 sprite를 두 번 받을 수 있다(추론).
  - 구현 후 측정 스크립트에서 asset별 요청 URL을 세어 확인한다.
  - 두 번 받는 경우가 있으면 다음 둘 중 하나로 고친다: 크기를 재기 전에는 sprite를 그리지 않는다(`ResizeObserver`가 없는 환경에서는 6배), 또는 첫 렌더에 `window.innerWidth`로 비율을 추정한다. 결과를 문서에 남긴다.

### 4-4. 테스트

- `tests/campusAssets.test.ts`: 모든 sprite에 대해 다음을 확인한다. 기존 PNG 헤더 디코더를 쓴다.
  - B 파일이 배율별로 있고, 크기가 정확히 1x × 배율이다.
  - 조명 마스크도 같은 크기다.
  - 이 검사로 이연 D4가 해소된다.
- `tests/campusScene.test.ts`:
  - 기본 렌더에서 B URL과 `auto`를 쓴다.
  - 레이어별 배율이 맞다(DPR 3에서 월드 6배·하늘 3배).
  - `hd`가 없는 asset은 1x를 `pixelated`로 그린다.
  - 불러오기에 실패하면 1x로 돌아간다.
  - 시험 모드 테스트는 정리한다.
- 삭제: `tests/sharpResample.test.ts`(결정 3), `tests/campusAssetModes.test.ts` 중 A·실행 중 로딩 부분(결정 4). `hdScale` 경계값 테스트는 옮겨서 유지한다.

### 4-5. 빌드와 배포 용량

- `vite.config.ts`에 `assetsInlineLimit` 함수를 추가한다(결정 6).
- `npm run build` 뒤 다음을 보고한다: `dist/` 전체 용량, `campus-hd` 파일 수, JS 번들 크기 변화, `dist/campus-raw`·`dist/campus-hd`(public 경로)가 없는지.

### 4-6. 측정과 화면 확인

- `.agent-workflow/261108-0950-campus-hd/bench.mjs`를 기본 모드만 재도록 바꿔 다시 잰다.
  - 조건: Lv.1·4·7·8 밤·10 × DPR 2·3 × 3회.
  - 비교 기준: B 계획 8-2의 B 값. 전송량·디코딩·RSS가 같은 범위인지 본다.
  - 4-3의 중복 요청 여부도 함께 확인한다.
- 비교 이미지: 전환 전 B 모드 스크린샷과 전환 후 기본 화면을 나란히 놓는다. 평균 픽셀 차이가 0에 가까워야 한다.
- 방문 화면(`VisitingScreen1Phone`·`VisitingScreen2Phone`·`VisitingSchoolPhone`)도 같은 `CampusScene`을 쓴다. e2e에서 오류가 없는지 확인한다.

### 4-7. 문서

- 수정 문서와 반영 내용:
  - `docs/261108-0223-campus_sharp_resample.md`: "B 전환으로 대체됨"과 이 문서 링크.
  - `docs/261107-2236-campus_asset_composition_plan.md`: 에셋 표시 방식 항목에 B와 이 문서 링크.
  - A·B 계획 문서: 범위 밖으로 남긴 "기본 화면 전환"이 이 문서에서 처리되었음을 적는다.
- 이 문서의 9장에 실행 결과를 기록한다.

## 5. 완료 기준

| # | 기준 |
|---|---|
| 1 | URL 파라미터 없이 기본 화면이 B로 그려진다. 레벨별 화면이 B 계획의 B 스크린샷과 같다(평균 픽셀 차이 ≤ 0.5). |
| 2 | 저장소만으로 빌드된다. `generated-images/`와 `public/campus-*` 없이 `npm run build`가 성공하고 B 파일을 포함한다. |
| 3 | sharp-bilinear 관련 파일과 시험 모드 A의 화면 코드가 남아 있지 않다(`rg` 확인). 결정 3·4를 기본안으로 정한 경우에 해당한다. |
| 4 | B 파일 크기·조명 마스크 크기 검사가 테스트로 고정된다(D4 해소). |
| 5 | `npx tsc --noEmit`, `npm test`, `npm run build`, `tests/e2e/browser-pass.mjs`가 통과한다. |
| 6 | 측정값이 B 계획 8-2의 B 값과 같은 범위이고, 같은 sprite를 두 번 받지 않는다. |

## 6. 위험

| 위험 | 대응 |
|---|---|
| 저장소가 약 10.6MB 커진다. 이후 원본을 다시 생성하면 바이너리 이력이 쌓인다 | 결정 1의 대안(LFS)은 별도로 남긴다. 재생성은 원본이 바뀔 때만 한다 |
| Safari/WebKit의 축소 화질이나 `<image>` 동작이 다를 수 있다 | 검증하지 않았다. 불러오기에 실패하면 1x로 돌아가는 경로는 테스트로 고정한다 |
| sharp-bilinear를 제거하면 B 파일을 불러오지 못할 때 1x가 `pixelated`로 고르지 않게 보인다 | 실패 경로에만 해당하며 결정 3의 대안으로 되돌릴 수 있다 |

## 7. 사용자 확인이 필요한 항목

1. 결정 1~6의 기본안을 그대로 적용할지.
2. 로컬 `public/campus-raw/`(53MB)와 `public/campus-hd/`(11MB)를 삭제할지(결정 5). git에 없는 파일이지만 스크립트로 다시 만들 수 있다.
3. 작업이 끝난 뒤 커밋할지. 지금까지의 A·B 시험 작업도 커밋되지 않은 상태다.

## 8. 범위 밖

- 지형 텍스처의 고해상도화.
- 다음 레벨 에셋 미리 받기(prefetch).
- 실제 모바일 기기 측정.

## 9. 실행 결과 (2026-11-08)

사용자 지시 "좋아. 기본안대로 진행해줘."에 따라 결정 1~6을 기본안대로 적용했다. 측정 자료는 `.agent-workflow/261108-1014-campus-hd-default/`에 있다(git 무시 대상).

### 9-1. 변경 내용

| 항목 | 내용 |
|---|---|
| 생성 스크립트 | `process.py --hd`의 출력 위치를 `src/assets/campus-hd/<배율>/`로 바꾸고, 1x 목록의 각 sprite에 `"hdScales": [3, 6]`을 기록한다. 1x만 다시 만들 때도 `hdScales`가 유지되는 것을 확인했다(목록 diff 없음). `--raw`는 비교용으로 남겼다 |
| 레지스트리 | `src/data/campusAssets.ts`에 `CampusAsset.hd`, `hdScale`, `hdFileFor`를 추가했다 |
| 화면 | `src/components/CampusScene.tsx`의 `SceneImage`가 레이어별 장치 비율(월드·하늘)로 HD 파일을 골라 `image-rendering: auto`로 그린다. HD가 없거나 불러오지 못하면 1x를 `pixelated`로 그린다 |
| 제거 | `useSharpImages`, `sharpResample`, worker, `tests/sharpResample.test.ts`, `campusAssetModes.ts`와 그 테스트, `?campusAssets` 처리 |
| 빌드 | `vite.config.ts`의 `build.assetsInlineLimit`가 `campus-hd` 경로만 인라인하지 않는다 |
| 기타 | `.gitignore`에서 `public/campus-hd/` 줄을 지웠다. 로컬 `public/campus-raw/`(53MB)와 `public/campus-hd/`(11MB)를 삭제했다 |

### 9-2. 완료 기준 대조

| # | 결과 | 근거 |
|---|---|---|
| 1 | **충족(해석 포함).** 수치 기준(평균 차이 ≤ 0.5)은 10개 중 4개가 넘었다(최대 0.93, Lv.4 DPR 2). 차이 위치를 확인하니 다른 사용자 클릭 파티클과 "터치!" 안내처럼 시간마다 바뀌는 요소뿐이었고, sprite·조명 픽셀은 같았다 | `shot-diff.json`, `compare/BvD-*.png` |
| 2 | 충족. `public/campus-*` 없이 빌드했고, `dist/`에 HD 파일 142개가 별도 파일로 들어갔다. 빌드는 `generated-images/`를 참조하지 않는다(`rg`) | `npm run build`, `find dist -name '*.png'` |
| 3 | 충족. `rg "sharp|prescale|campusAssets=|campusAssetModes|campus-raw" src tests vite.config.ts` 결과가 없다 | 명령 출력 |
| 4 | 충족. `tests/campusAssets.test.ts`가 HD 파일과 조명 마스크의 크기를 검사한다. 3배 파일 하나를 6배 파일로 바꾸면 실패하는 것을 확인했다 | 변이 확인 |
| 5 | 충족. `tsc` 통과, `npm test` 188개 통과, `npm run build` 성공, `tests/e2e/browser-pass.mjs` 통과(콘솔 오류 0) | 명령 출력, `e2e/browser-report.md` |
| 6 | 충족. 30회 모두 같은 sprite를 두 번 받지 않았다. 측정값은 B와 같은 범위다(9-3) | `results.json`의 `doubleFetched` |

- 1번의 비교 기준(B 계획의 B 스크린샷)은 시험 모드로만 찍을 수 있었다. 시험 모드를 제거했으므로 애니메이션 요소를 고정해 다시 찍을 수는 없다.
- 방문 화면: e2e는 방문 화면을 열지 않는다. 그래서 별도 스크립트(`visiting.mjs`)로 2-Phone 방문 화면을 열었다. 장면 2개 모두 sprite 28개가 HD로 그려졌고, 오류는 favicon 404뿐이었다(전환과 무관, CDP로 URL 확인).
- 크기를 재기 전 6배 요청(4-3): 크기는 `useLayoutEffect`에서 그리기 전에 재므로, 실제로는 6배 요청이 나가지 않았다(추론: 요청 기록상 DPR 2의 Lv.7·8·10은 3배만 받음). 그래서 4-3의 보완은 적용하지 않았다.

### 9-3. 측정 (중앙값, 3회, CPU 4배 감속)

| Lv | DPR | 전송 KiB (B → 기본) | 디코딩 ms | RSS 증가 MB | 긴 작업 ms | fps | 받은 배율 |
|---|---|---|---|---|---|---|---|
| 1 | 2 | 518 → 508 | 21 → 20 | 252 → 248 | 66 → 64 | 60 | 3·6 |
| 4 | 2 | 1630 → 1604 | 61 → 62 | 261 → 257 | 71 → 65 | 60 | 3·6 |
| 7 | 2 | 1084 → 1057 | 40 → 37 | 255 → 253 | 73 → 62 | 60 | 3 |
| 8 밤 | 2 | 893 → 871 | 42 → 38 | 259 → 257 | 78 → 78 | 60 | 3 |
| 10 | 2 | 838 → 804 | 32 → 25 | 277 → 275 | 81 → 87 | 60 | 3 |
| 1 | 3 | 518 → 508 | 19 → 21 | 250 → 248 | 64 → 62 | 60 | 3·6 |
| 4 | 3 | 1630 → 1604 | 68 → 68 | 261 → 258 | 71 → 65 | 60 | 3·6 |
| 7 | 3 | 2488 → 2462 | 93 → 87 | 270 → 263 | 73 → 70 | 60 | 3·6 |
| 8 밤 | 3 | 1890 → 1869 | 80 → 74 | 270 → 262 | 77 → 76 | 60 | 3·6 |
| 10 | 3 | 1744 → 1711 | 64 → 69 | 286 → 280 | 87 → 82 | 60 | 3·6 |

- 전송량이 10~34KiB 줄었다. 시험 모드에서는 목록을 받는 동안 1x를 먼저 받았는데(이연 D3), 이제는 받지 않기 때문이다(추론).
- 요약 스크립트(`summarize.mjs`)로 B 계획의 원자료를 다시 계산해 기존 요약과 같은 값이 나오는 것을 확인한 뒤 비교했다.

### 9-4. 빌드 용량

| 항목 | 전환 전 (HEAD `2735fdb`) | 전환 후 |
|---|---|---|
| `dist/` 전체 | 4.4MB | 15MB |
| `dist/` PNG 파일 | 17개 | 159개 (+HD 142개) |
| JS 번들 | 680,885B + worker 418B | 692,317B (+11.0KB, HD URL 목록) |
| 저장소에 추가되는 파일 | — | `src/assets/campus-hd/` 11MB (142개) |

전환 전 값은 HEAD를 임시 worktree에서 빌드해 쟀다. Vite 인라인 대상은 1x의 작은 PNG 61개뿐이다.

### 9-5. 남은 항목

- 이연 목록: `.agent-workflow/261108-1014-campus-hd-default/deferred.md`.
- 검증하지 않음: Safari/WebKit 표시, 실제 모바일 기기.
- 커밋하지 않았다. A·B 시험 작업과 함께 사용자 확인을 기다린다.
