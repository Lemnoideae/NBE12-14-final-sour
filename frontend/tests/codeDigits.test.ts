import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractCodeDigits } from '../src/utils/codeDigits';

test('인증 코드 추출: 독립된 6자리 우선, 없으면 숫자를 모은다', () => {
  const cases: Array<[string, string]> = [
    ['123456', '123456'], ['인증 코드: 123456', '123456'],
    ['앞 12 뒤 345', '12345'], ['숫자 없음', ''],
    ['1234567', '1234567'], ['전화 12 코드 456789 끝', '456789'],
  ];
  for (const [input, expected] of cases) assert.equal(extractCodeDigits(input), expected, input);
});
