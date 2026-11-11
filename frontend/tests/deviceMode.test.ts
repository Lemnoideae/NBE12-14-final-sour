import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import { installDialogStub } from './helpers/dialogStub';
import { assertAbsent, assertSameNode } from './helpers/domAssert';
import { stubMatchMedia } from './helpers/matchMedia';

// T2 (docs/261110-1005-mockup_remaining_tasks_plan.md §5): phone detection, the full shell and the mock menu sheet (Q5).

const assets = registerHooks({
  load(url, context, nextLoad) {
    if (/\.(jpg|png|webp|svg)(\?.*)?$/.test(url)) {
      return { format: 'module', source: `export default ${JSON.stringify(new URL(url).pathname)};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
})) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
dom.window.HTMLElement.prototype.scrollIntoView = function () {};
installDialogStub(dom.window);

const { render, screen, fireEvent, cleanup, within } = await import('@testing-library/react');
const { default: App } = await import('../src/App');
const { MockGameProvider } = await import('../src/hooks/useMockGame');
const { MOBILE_DEVICE_QUERY, resolveDeviceMode } = await import('../src/utils/deviceMode');

const win = dom.window as unknown as Window;
const asPhone = () => stubMatchMedia(win, [MOBILE_DEVICE_QUERY]);
const asDesktop = () => stubMatchMedia(win, []);
const mountApp = () => render(React.createElement(MockGameProvider, null, React.createElement(App)));
const shells = () => [...document.querySelectorAll<HTMLElement>('[data-phone-shell]')];

beforeEach(() => dom.reconfigure({ url: 'http://localhost/' }));
afterEach(cleanup);
after(() => { assets.deregister(); dom.window.close(); });

test('T2: ?device=full·framed가 미디어쿼리보다 우선하고, 그 밖의 값은 무시한다', () => {
  assert.equal(resolveDeviceMode('', true), 'full');
  assert.equal(resolveDeviceMode('', false), 'framed');
  assert.equal(resolveDeviceMode('?device=full', false), 'full');
  assert.equal(resolveDeviceMode('?device=framed', true), 'framed');
  assert.equal(resolveDeviceMode('?device=tablet', true), 'full');
  assert.equal(resolveDeviceMode('?x=1&device=full', false), 'full');
  // Portrait phones (width) and phones on their side (height) both count; a mouse never does.
  assert.match(MOBILE_DEVICE_QUERY, /\(pointer: coarse\) and \(max-width: 480px\)/);
  assert.match(MOBILE_DEVICE_QUERY, /\(pointer: coarse\) and \(max-height: 480px\)/);
});

test('T2: index.html viewport에 viewport-fit=cover가 있다 (safe-area inset 사용 조건)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';
  assert.match(viewport, /(^|,\s*)viewport-fit=cover(\s*,|$)/);
});

test('T2: 데스크톱은 발표 헤더·메뉴·[시연] 도구와 390×844 프레임을 그대로 보인다', () => {
  asDesktop();
  mountApp();
  assert.ok(screen.getByRole('navigation', { name: '서비스 흐름' }));
  assert.ok(screen.getByRole('region', { name: '[시연] 도구' }));
  assertAbsent(screen.queryByRole('button', { name: '목업' }));
  const [shell] = shells();
  assert.equal(shell.dataset.phoneShell, 'framed');
  assert.match(shell.className, /h-\[844px\]/);
  assert.equal(shell.querySelectorAll('[data-phone-status-bar], [data-phone-home-bar]').length, 2);
});

test('T2: 폰에서는 서비스 화면이 전체 화면 셸이 되고, 메뉴·도구는 “목업” 시트로 들어간다 (Q5)', () => {
  asPhone();
  mountApp();
  assertAbsent(screen.queryByRole('navigation', { name: '서비스 흐름' }), '페이지에는 메뉴 없음');
  assertAbsent(screen.queryByRole('region', { name: '[시연] 도구' }));
  const [shell] = shells();
  assert.equal(shell.dataset.phoneShell, 'full');
  assert.ok(shell.classList.contains('phone-shell-full'));
  assert.doesNotMatch(shell.className, /h-\[844px\]|border-4/, '고정 크기·테두리 없음');
  assert.equal(shell.querySelectorAll('[data-phone-status-bar], [data-phone-home-bar]').length, 0, '실기기 상태바와 겹치는 목업 상태바·홈 바 없음');
  assert.ok(document.querySelector('main[data-game-main] [aria-label="캠퍼스 클릭 영역"]'));

  const trigger = screen.getByRole('button', { name: '목업' });
  trigger.focus();
  fireEvent.click(trigger);
  const sheet = screen.getByRole('dialog', { name: '목업 메뉴' });
  assert.ok(within(sheet).getByRole('navigation', { name: '서비스 흐름' }));
  assert.ok(within(sheet).getByRole('navigation', { name: '[시연] 시안 비교·도구' }));
  const tools = within(sheet).getByRole('region', { name: '[시연] 도구' });

  // A demo tool keeps the sheet open; choosing a screen closes it and shows that screen.
  fireEvent.change(within(tools).getByRole('combobox', { name: '[시연] 시간대' }), { target: { value: 'night' } });
  assert.ok(screen.getByRole('dialog', { name: '목업 메뉴' }));
  fireEvent.click(within(sheet).getByRole('button', { name: /랭킹 화면/ }));
  assertAbsent(screen.queryByRole('dialog', { name: '목업 메뉴' }));
  assertSameNode(document.activeElement, trigger, '닫으면 “목업” 버튼으로 포커스가 돌아온다');
  assertAbsent(document.querySelector('main[data-game-main]'), '메인 게임에서 랭킹 화면으로 바뀐다');
  assert.equal(shells()[0].dataset.phoneShell, 'full');
});

test('T2: 폰에서도 시안 비교 화면은 390×844 프레임을 유지하고, ?device=framed는 데스크톱 화면을 강제한다', () => {
  asPhone();
  mountApp();
  fireEvent.click(screen.getByRole('button', { name: '목업' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '목업 메뉴' })).getByRole('button', { name: /2-Phone 채팅 비교/ }));
  assert.ok(shells().length >= 2);
  for (const shell of shells()) assert.equal(shell.dataset.phoneShell, 'framed');
  cleanup();

  dom.reconfigure({ url: 'http://localhost/?device=framed' });
  mountApp();
  assert.ok(screen.getByRole('navigation', { name: '서비스 흐름' }));
  assert.equal(shells()[0].dataset.phoneShell, 'framed');
});

test('T2: 폰의 순차 온보딩은 바깥 안내문 없이 전체 화면이고, 목업 메일함 안내는 화면 안에 남는다', () => {
  asPhone();
  mountApp();
  fireEvent.click(screen.getByRole('button', { name: '목업' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '목업 메뉴' })).getByRole('button', { name: /순차 온보딩/ }));
  assertAbsent(screen.queryByText('순차 온보딩 · 목업 인증 (실제 메일 발송 없음)'));
  const onboarding = screen.getByRole('region', { name: '순차 온보딩' });
  assert.equal(onboarding.dataset.phoneShell, 'full');
});
