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
| 로컬 개발 (목업 데이터) | `npm run dev` | 상단 **테스트 도구** 버튼에서 열기 |
| 로컬 개발 (백엔드 연결, 실제 계정 로그인) | `npm run dev:api` | 로그인 후 캠퍼스 상단 **테스트 도구** 버튼에서 열기 |
| 지정 테스트 빌드 | `npm run build -- --mode campus-test` | 상단 **테스트 도구** 버튼에서 열기 |
| 운영 빌드 | `npm run build` | 표시하지 않으며 목업·기기 강제 URL도 무시 |

`npm run dev`는 목업 데이터를 사용합니다. 로그인 화면이 없고, 정해진 가상 계정으로 로그인한 것으로 가정합니다. 실제 계정으로 로그인하고 클릭·구매를 DB에 반영하려면 `npm run dev:api`를 쓰세요. 이 명령은 `frontend/.env.api`(`VITE_API_MODE=api`)를 읽고, `/api`·`/ws` 요청을 `http://localhost:8080`으로 넘깁니다. 지정 테스트 빌드를 백엔드에 연결하려면 명령 앞에 `VITE_API_MODE=api`를 붙이세요. 운영 빌드는 항상 API를 사용하며, 기존 **내 정보 → 관리자 메뉴 → 테스트 도구**는 관리자에게 계속 제공됩니다.

### 로컬에서 실제 계정으로 로그인하기

1. Docker를 켜고, 저장소 루트의 `.env.example`을 `.env`로 복사해 `[필수]` 값을 채웁니다.
2. 저장소 루트에서 `./gradlew bootRun`을 실행합니다. `compose.yaml`의 Postgres·Redis·Floci가 함께 뜨고 Flyway가 스키마와 학교·학과 데이터를 넣습니다.
3. `frontend/`에서 `npm run dev:api`를 실행하고 `http://localhost:3000`을 엽니다.
4. **회원가입**에서 학교 이메일(예: `아무거나@yonsei.ac.kr`)을 입력합니다. `SPRING_MAIL_HOST`가 없으면 메일을 보내지 않고 백엔드 로그에 `[개발용] … code=123456`으로 인증 코드를 남깁니다.

셸에 `SPRING_MAIL_*`가 설정되어 있으면 실제 메일이 나갑니다. 빈 값도 설정된 것으로 보므로, 로그로 받으려면 `env -u SPRING_MAIL_HOST ./gradlew bootRun`처럼 변수를 지우세요. `localhost` 대신 LAN IP(`http://192.168.x.x:3000`)로 접속하면 브라우저가 `Secure` refresh 쿠키를 거부해 새로고침 후 로그인이 풀릴 수 있습니다. 자세한 내용은 위키의 [로컬 실행 가이드](https://github.com/prgrms-be-devcourse/NBE12-14-final-sour/wiki/로컬-실행-가이드)를 보세요.

지정 테스트 빌드의 산출물은 테스트 환경에만 배포하세요. `?device=framed`, `?device=full`, `?campusDebug`, `?campusShot=7`, `?apiCheck`는 허용 환경에서만 프리뷰·진단에 쓸 수 있습니다. `npm run preview`는 빌드에 기록된 설정을 바꾸지 않습니다. 화면 전환 도구를 사용하는 `frontend/tests/e2e/` 브라우저 검사는 로컬 개발 서버나 `campus-test` 빌드의 프리뷰를 대상으로 실행하세요.
