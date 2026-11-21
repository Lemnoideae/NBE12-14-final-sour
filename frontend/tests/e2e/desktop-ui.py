"""Capture PC UI measurements; --check exits 1 when a visual invariant fails.

Run against a local Vite dev server with VITE_API_MODE=mock. For an API shelf
control, pass --api-url for a second local server with VITE_API_MODE=api.
Requires Python Playwright and Chromium; not part of npm test.
"""

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

VIEWPORTS = [(1024, 720, 1), (1280, 720, 1), (1440, 900, 1), (1920, 1080, 1), (2560, 1440, 2)]
CREAM = 'rgb(253, 245, 223)'
TOLERANCE = 1  # CSS px; DOM geometry can round fractional borders


def ready(page, url):
    page.goto(url)
    panel = page.get_by_role('complementary', name='전국 경쟁 패널')
    expect(panel).to_be_visible()
    page.evaluate('async () => { await document.fonts.ready; }')
    return panel


def snapshot(page, path):
    page.screenshot(path=path, animations='disabled')


def shop_metrics(page, path):
    page.get_by_role('button', name='상점', exact=True).click()
    shop = page.locator('[data-game-layout="shop"]')
    expect(shop.get_by_text('원목 선반 진열대', exact=True)).to_be_visible()
    cards = shop.get_by_role('button', name='구매 선택', exact=False)
    expect(cards.first).to_be_visible()
    cards.first.scroll_into_view_if_needed()
    altar = shop.get_by_text('내 클리커 강화 제단', exact=True).evaluate('''e => {
        const {left, right} = e.closest('.rpg-box').getBoundingClientRect();
        return {left, right};
    }''')
    edges = cards.evaluate_all('''cards => {
        const rects = cards.map(card => card.getBoundingClientRect());
        const firstRow = rects.filter(rect => rect.top < rects[0].bottom && rect.bottom > rects[0].top);
        return {
            count: cards.length, firstLeft: rects[0].left,
            rightmost: firstRow.length > 1 ? Math.max(...firstRow.map(rect => rect.right)) : null,
            firstLayoutLeft: cards[0].offsetParent.getBoundingClientRect().left + cards[0].offsetLeft,
            firstScale: getComputedStyle(cards[0]).scale,
        };
    }''')
    snapshot(page, path)
    left_delta = edges['firstLeft'] - altar['left']
    right_delta = None if edges['rightmost'] is None else edges['rightmost'] - altar['right']
    return {**edges, 'altar': altar, 'leftDelta': left_delta, 'rightDelta': right_delta,
            'aligned': abs(left_delta) <= TOLERANCE and (right_delta is None or abs(right_delta) <= TOLERANCE)}


def mock_case(browser, args, width, height, dpr):
    viewport = {'width': width, 'height': height}
    name = f'{width}x{height}-dpr{dpr}'
    page = browser.new_page(viewport=viewport, device_scale_factor=dpr, reduced_motion='reduce')
    try:
        panel = ready(page, args.mock_url)
        panel.get_by_role('tab', name='지도', exact=True).click()
        regions = panel.get_by_role('group', name='권역 선택')
        expect(regions.get_by_role('button')).to_have_count(7)
        expect(regions.get_by_role('button', name='전체', exact=True)).to_have_attribute('aria-pressed', 'true')
        page.evaluate('async () => { await document.fonts.ready; }')
        fonts = {
            'brand': page.get_by_role('button', name='대대대 내 캠퍼스').evaluate('e => getComputedStyle(e).fontFamily'),
            'heading': panel.get_by_role('heading', name='전국 경쟁', exact=True).evaluate('e => getComputedStyle(e).fontFamily'),
            'search': panel.get_by_role('textbox', name='학교 검색').evaluate('e => getComputedStyle(e).fontFamily'),
            'faces': page.evaluate('''() => [...document.fonts].filter(face => face.family.includes('Maplestory'))
                .map(({weight, status}) => ({weight, status}))'''),
        }
        fonts['consistent'] = all(fonts[key].split(',')[0].strip('\'" ') == 'Maplestory'
                                  for key in ('brand', 'heading', 'search'))
        chips = regions.evaluate('''e => {
            const left = e.getBoundingClientRect().left + e.clientLeft;
            const right = left + e.clientWidth;
            const clipped = [...e.querySelectorAll('button')].map(button => {
                const r = button.getBoundingClientRect();
                return {label: button.textContent.trim(), left: Math.max(0, left - r.left), right: Math.max(0, r.right - right)};
            });
            return {width: e.clientWidth, scrollWidth: e.scrollWidth, scrollLeft: e.scrollLeft, clipped};
        }''')
        chips['allVisible'] = all(max(chip['left'], chip['right']) <= TOLERANCE for chip in chips['clipped'])
        area = panel.get_by_test_id('map-area')
        top3 = area.locator('[data-top-rank]').first
        expect(top3).to_be_visible()
        marker = top3.evaluate('''e => {
            const logo = e.querySelector('[data-logo-status]');
            const name = e.lastElementChild.firstElementChild;
            const rank = e.firstElementChild.querySelector('span:last-child');
            const scale = new DOMMatrixReadOnly(getComputedStyle(e.closest('[data-map-layer]')).transform).a;
            return {logoWidth: logo.getBoundingClientRect().width, scale,
                nameSize: parseFloat(getComputedStyle(name).fontSize) * scale,
                scoreSize: parseFloat(getComputedStyle(rank).fontSize) * scale};
        }''')
        snapshot(page, args.out / f'{name}-national.png')
        jeju = regions.get_by_role('button', name='제주', exact=True)
        jeju.click()
        expect(jeju).to_have_attribute('aria-pressed', 'true')
        expect(area).to_have_attribute('data-region', '제주')
        schools = panel.get_by_role('region', name='학교 목록')
        expect(schools.get_by_role('button')).to_have_count(2)
        schools.scroll_into_view_if_needed()
        gap = schools.evaluate('''e => {
            const rect = e.getBoundingClientRect();
            const body = e.closest('[data-testid="map-scroll-body"]');
            const bottom = Math.min(body.getBoundingClientRect().bottom, innerHeight);
            const height = Math.max(0, bottom - rect.bottom);
            let color = null;
            if (height > 1) {
                const x = rect.left + 8;
                const y = rect.bottom + Math.min(8, height / 2);
                color = document.elementsFromPoint(x, y).map(node => getComputedStyle(node).backgroundColor)
                    .find(color => color !== 'rgba(0, 0, 0, 0)') ?? null;
            }
            return {height, color};
        }''')
        gap['matchesPanel'] = gap['height'] <= TOLERANCE or gap['color'] == CREAM
        snapshot(page, args.out / f'{name}-jeju.png')
        shop = shop_metrics(page, args.out / f'{name}-shop-mock.png') if (width, height, dpr) == (1440, 900, 1) else None
        return {'name': name, 'viewport': viewport, 'dpr': dpr, 'fonts': fonts, 'chips': chips,
                'top3': marker, 'jejuGap': gap, 'mockShop': shop}
    finally:
        page.close()


def api_shelf(browser, args):
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    profile = {'id': 501, 'nickname': '검증학생', 'email': 'student@example.test', 'role': 'USER', 'status': 'ACTIVE',
               'profileImageUrl': None, 'university': {'id': 8, 'name': '한양대학교', 'logoUrl': None},
               'department': {'id': 1, 'name': '공학과'}, 'clicker': {'level': 1, 'clickPower': 1, 'nextLevelRequiredScore': 200},
               'totalContribScore': 1000, 'totalAttackScore': 0}
    item = {'id': 3, 'name': '테스트 커피', 'content': '검증용 아이템', 'type': 'MULTIPLIER', 'payType': 'CONTRIBUTION',
            'price': 120, 'durationSeconds': 30}
    data = {'/auth/reissue': {'accessToken': 'layout-fixture', 'expiresInSeconds': 3600}, '/users/me': profile,
            '/items': [item, {**item, 'id': 4, 'name': '테스트 간식'}], '/items/me/active': None,
            '/map/universities': [], '/clickers': []}

    def fixture(route):
        path = urlsplit(route.request.url).path.removeprefix('/api/v1')
        if path in data:
            route.fulfill(json={'code': 'SUCCESS', 'message': '요청이 성공했습니다.', 'data': data[path]})
        else:
            route.fulfill(status=404, json={'code': 'NOT_FOUND', 'message': 'No desktop test fixture'})

    try:
        page.route('**/api/v1/**', fixture)
        ready(page, args.api_url)
        return shop_metrics(page, args.out / '1440x900-dpr1-shop-api.png')
    finally:
        page.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mock-url', default='http://127.0.0.1:4316/')
    parser.add_argument('--api-url')
    parser.add_argument('--chromium', help='Executable path; omit to use Playwright Chromium')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--check', action='store_true', help='Exit 1 on visual invariant failures')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium)
        cases = [mock_case(browser, args, *spec) for spec in VIEWPORTS]
        api = api_shelf(browser, args) if args.api_url else None
        version = browser.version
        browser.close()

    failures = []
    for case in cases:
        for key, passed in (
            ('Maplestory inheritance', case['fonts']['consistent']),
            ('all seven region chips fully visible', case['chips']['allVisible']),
            ('TOP 3 logo ≥32 CSS px and name/score ≥12 CSS px after scale',
             case['top3']['logoWidth'] >= 32 - TOLERANCE
             and min(case['top3']['nameSize'], case['top3']['scoreSize']) >= 12 - TOLERANCE),
            ('Jeju list blank area cream or absent', case['jejuGap']['matchesPanel']),
        ):
            if not passed:
                failures.append(f"{case['name']}: {key}")
        if case['mockShop'] and not case['mockShop']['aligned']:
            failures.append(f"{case['name']}: mock shelf outer edges aligned")
    if api and not api['aligned']:
        failures.append('1440x900-dpr1: API shelf outer edges aligned')
    report = {'chromium': version, 'cases': cases, 'apiShop': api, 'failures': failures}
    (args.out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for failure in failures:
        print(f'FAIL {failure}')
    print(f'{len(failures)} failed observations; report: {args.out / "report.json"}')
    return int(args.check and bool(failures))


if __name__ == '__main__':
    raise SystemExit(main())
