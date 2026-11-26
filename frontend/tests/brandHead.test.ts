import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const doc = new JSDOM(html).window.document;
const title = '대대대 - 대학교 대 대학교';
const description = '학교 이메일로 인증하고 클릭으로 우리 학교 순위를 끌어올리는 실시간 캠퍼스 대항전. 전국 대학과 겨루며 캠퍼스를 키워 보세요.';
const content = (selector: string) => doc.querySelector(selector)?.getAttribute('content');

test('① index.html에 한빛이 없다', () => assert.doesNotMatch(html, /한빛/, 'frontend/index.html의 옛 학교 문구를 교체하세요'));
test('② index.html title은 확정된 서비스 제목이다', () => assert.equal(doc.title, title, 'frontend/index.html title을 수정하세요'));
test('③ OG 제목과 설명은 확정된 title·description과 같다', () => {
  assert.equal(content('meta[name="description"]'), description, 'frontend/index.html description을 수정하세요');
  assert.equal(content('meta[property="og:title"]'), title, 'frontend/index.html og:title을 수정하세요');
  assert.equal(content('meta[property="og:description"]'), description, 'frontend/index.html og:description을 수정하세요');
});
test('④ OG 이미지가 없으면 twitter card는 summary다', () => {
  if (!doc.querySelector('meta[property="og:image"]')) assert.equal(content('meta[name="twitter:card"]'), 'summary', 'frontend/index.html twitter:card를 수정하세요');
});
test('시작 화면은 정의된 메이플 픽셀 글꼴 변수를 사용한다', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /--pixel-font:\s*'Maplestory'/, 'frontend/src/index.css의 글꼴 정의를 확인하세요');
  assert.match(css, /\.guest-entry\s*\{\s*font-family:\s*var\(--pixel-font\)/, 'frontend/src/index.css의 시작 화면 글꼴 변수를 수정하세요');
});
test('서비스 OG 이름과 한국어 locale을 지정한다', () => {
  assert.equal(content('meta[property="og:site_name"]'), '대대대', 'frontend/index.html og:site_name을 추가하세요');
  assert.equal(content('meta[property="og:locale"]'), 'ko_KR', 'frontend/index.html og:locale을 추가하세요');
});
