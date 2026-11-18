import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createApiClient } from '../src/api/client';
import { createApiFaults } from '../src/api/faults';
import {
  checkNicknameAvailability,
  nicknameProblem,
  NICKNAME_RULE,
  PASSWORD_PATTERN,
  passwordProblem,
  requestEmailCode,
  signup,
  SIGNUP_ERROR_CODES,
  SIGNUP_SERVER_RULES,
  verifyEmailCode,
} from '../src/api/auth';
import { getDepartments } from '../src/api/universities';

// Sign-up API module (SCRUM-151): what each call sends, and the input rules copied from the backend. The copies are
// checked against the Java source, so a rule changed on one side only fails here.

const JAVA_ROOT = new URL('../../src/main/java/com/back/nbe1214finalsour/', import.meta.url);
const javaSource = (path: string) => readFileSync(new URL(path, JAVA_ROOT), 'utf8');

interface Sent { url: string; method: string; body: unknown; authorization: string | null }

function recordingClient(data: unknown = {}) {
  const sent: Sent[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    sent.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      authorization: headers.get('Authorization'),
    });
    return new Response(JSON.stringify({ code: 'SUCCESS', message: '요청이 성공했습니다.', data }), { status: 200 });
  }) as typeof globalThis.fetch;
  const client = createApiClient({ fetch, faults: createApiFaults({ delayMs: 0, failDelayMs: 0 }) });
  // A signed-in session must not leak its token into the public sign-up calls.
  client.session.signIn('signed-in-token');
  return { client, sent };
}

test('가입 API는 /api/v1 경로로 보내고, 로그인 중이어도 토큰을 붙이지 않는다', async () => {
  const { client, sent } = recordingClient();
  await requestEmailCode(client, 'a@hanyang.ac.kr');
  await verifyEmailCode(client, 'a@hanyang.ac.kr', '012345');
  await signup(client, { signupToken: 't', nickname: '새내기', password: 'abc123!@', departmentId: 7 });
  await checkNicknameAvailability(client, '새 내기');
  await getDepartments(client, 8);

  assert.deepEqual(sent.map(({ method, url }) => `${method} ${url}`), [
    'POST /api/v1/auth/email/code',
    'POST /api/v1/auth/email/verify',
    'POST /api/v1/auth/signup',
    'GET /api/v1/users/nickname/availability?nickname=%EC%83%88+%EB%82%B4%EA%B8%B0',
    'GET /api/v1/universities/8/departments',
  ]);
  assert.deepEqual(sent.map((entry) => entry.authorization), [null, null, null, null, null]);
  assert.deepEqual(sent[0].body, { email: 'a@hanyang.ac.kr' });
  assert.deepEqual(sent[1].body, { email: 'a@hanyang.ac.kr', code: '012345' });
  assert.deepEqual(sent[2].body, { signupToken: 't', nickname: '새내기', password: 'abc123!@', departmentId: 7 },
    '학교는 보내지 않는다 (서버가 인증된 이메일로 정한다)');
});

test('닉네임 규칙: 2~12자(String.length), 앞뒤 공백 불가', () => {
  for (const ok of ['새내', '열정학번사자', 'a b', 'x'.repeat(12)]) assert.equal(nicknameProblem(ok), null, ok);
  for (const bad of ['', '새', ' 새내기', '새내기 ', 'x'.repeat(13), '😀'.repeat(7)]) {
    assert.match(nicknameProblem(bad) ?? '', /2~12자/, JSON.stringify(bad));
  }
});

test('비밀번호 규칙: 영문·숫자·특수문자 포함 8~64자 ASCII, 확인 값이 같아야 한다', () => {
  assert.equal(passwordProblem('abcd123!', 'abcd123!'), null);
  for (const bad of ['abcd1234', 'abcdefg!', '1234567!', 'ab1!', 'abc 123!', '비밀번호123!', `a1!${'x'.repeat(62)}`]) {
    assert.match(passwordProblem(bad, bad) ?? '', /8~64자/, bad);
  }
  assert.equal(passwordProblem('abcd123!', 'abcd123?'), '비밀번호 확인이 일치하지 않습니다.');
});

// Sensors: the client copies these from the backend; a change there must be copied here.
test('비밀번호·닉네임 규칙은 @Password·@Nickname 소스와 같다', () => {
  const password = javaSource('domain/user/validation/Password.java').match(/@Pattern\(regexp = "(.+)"\)/);
  assert.ok(password, '@Password의 @Pattern을 찾지 못함');
  assert.equal(PASSWORD_PATTERN.source, `^${password[1].replaceAll('\\\\', '\\')}$`,
    'src/api/auth.ts의 PASSWORD_PATTERN을 Password.java에 맞추세요');

  const nickname = javaSource('domain/user/validation/Nickname.java');
  const size = nickname.match(/@Size\(min = (\d+), max = (\d+)\)/);
  const pattern = nickname.match(/@Pattern\(regexp = "(.+)"\)/);
  assert.ok(size && pattern, '@Nickname의 @Size·@Pattern을 찾지 못함');
  assert.deepEqual([NICKNAME_RULE.min, NICKNAME_RULE.max], [Number(size[1]), Number(size[2])]);
  assert.equal(NICKNAME_RULE.pattern.source, `^${pattern[1].replaceAll('\\\\', '\\')}$`);
});

test('재요청 대기·시도 횟수는 EmailVerificationService 상수와 같다', () => {
  const service = javaSource('domain/auth/service/EmailVerificationService.java');
  assert.equal(Number(service.match(/COOLDOWN = Duration\.ofSeconds\((\d+)\)/)?.[1]), SIGNUP_SERVER_RULES.resendCooldownSeconds);
  assert.equal(Number(service.match(/MAX_ATTEMPTS = (\d+);/)?.[1]), SIGNUP_SERVER_RULES.maxCodeAttempts);
});

test('가입 화면이 이름으로 다루는 오류 코드는 ErrorCode.java에 있다', () => {
  const source = javaSource('global/exception/ErrorCode.java');
  const backendCodes = new Set([...source.matchAll(/^\s+([A-Z][A-Z0-9_]+)\(HttpStatus\./gm)].map((m) => m[1]));
  for (const code of Object.values(SIGNUP_ERROR_CODES)) assert.ok(backendCodes.has(code), `${code}가 ErrorCode.java에 없음`);
});
