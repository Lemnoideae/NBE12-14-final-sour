# NBE12-14-final-sour
최종 프로젝트 시큼이들

## 프로젝트 구조

```
├── src
│   └── main
│       ├── java
│       │   └── com
│       │       └── back
│       │           └── nbe1214finalsour
│       │               ├── domain
│       │               │   └── user
│       │               │       ├── controller
│       │               │       ├── dto
│       │               │       ├── entity
│       │               │       ├── repository
│       │               │       └── service
│       │               └── global
│       │                   ├── config
│       │                   ├── exception
│       │                   └── security
│       └── resources
├── frontend
├── .gitignore
├── build.gradle.kts
└── README.md
```

## 프론트엔드 실행 (`frontend/`)

| 환경 | 명령 | 목업 도구 |
|---|---|---|
| 로컬 개발 | `npm run dev` | 상단 **테스트 도구** 버튼에서 열기 |
| 지정 테스트 빌드 | `npm run build -- --mode campus-test` | 상단 **테스트 도구** 버튼에서 열기 |
| 운영 빌드 | `npm run build` | 표시하지 않으며 목업·기기 강제 URL도 무시 |

로컬 개발과 지정 테스트 빌드는 기본적으로 목업 데이터를 사용합니다. 백엔드에 연결하려면 명령 앞에 `VITE_API_MODE=api`를 붙이세요. API 모드의 목업 도구 버튼은 로그인 후 캠퍼스에만 표시됩니다. 운영 빌드는 항상 API를 사용하며, 기존 **내 정보 → 관리자 메뉴 → 테스트 도구**는 관리자에게 계속 제공됩니다.

지정 테스트 빌드의 산출물은 테스트 환경에만 배포하세요. `?device=framed`, `?device=full`, `?campusDebug`, `?campusShot=7`, `?apiCheck`는 허용 환경에서만 프리뷰·진단에 쓸 수 있습니다. `npm run preview`는 빌드에 기록된 설정을 바꾸지 않습니다. 화면 전환 도구를 사용하는 `frontend/tests/e2e/` 브라우저 검사는 로컬 개발 서버나 `campus-test` 빌드의 프리뷰를 대상으로 실행하세요.
