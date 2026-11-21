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


def menu_metrics(controls):
    return controls.evaluate_all('''controls => controls.map(button => {
        const rect = button.getBoundingClientRect();
        const icon = button.querySelector('.game-nav-icon');
        const label = button.querySelector('.game-nav-label');
        const labelRect = label.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(label);
        const lines = [...range.getClientRects()];
        const style = getComputedStyle(button);
        return {label: label.textContent, lines: lines.length,
            fits: rect.left >= 0 && rect.right <= innerWidth + 1 && lines.length > 0 && lines.length <= 2 && lines.every(line =>
                line.left >= rect.left - 1 && line.right <= rect.right + 1 && line.bottom <= rect.bottom + 1),
            iconLeft: icon.getBoundingClientRect().width > 0 && icon.getBoundingClientRect().right <= labelRect.left + 1,
            height: rect.height, fontSize: parseFloat(style.fontSize), raised: style.boxShadow !== 'none',
        };
    })''')


def mock_menu_flow(page, panel, path):
    left = page.get_by_role('complementary', name='학교 패널')
    detail = left.get_by_role('tab', name='상세')
    chat = left.get_by_role('tab', name='우리 학교 채팅')
    guestbook = left.get_by_role('tab', name='방명록')
    detail.focus()
    page.keyboard.press('ArrowRight')
    expect(chat).to_be_focused()
    expect(detail).to_have_attribute('aria-selected', 'true')
    assert chat.evaluate("e => getComputedStyle(e).outlineStyle") == 'solid'
    assert chat.evaluate("e => getComputedStyle(e).backgroundColor") != detail.evaluate(
        "e => getComputedStyle(e).backgroundColor")
    page.keyboard.press('End')
    expect(guestbook).to_be_focused()
    page.keyboard.press('Home')
    expect(detail).to_be_focused()
    page.keyboard.press('ArrowRight')
    page.keyboard.press('Enter')
    expect(chat).to_have_attribute('aria-selected', 'true')
    page.keyboard.press('Home')
    page.keyboard.press('Space')
    expect(detail).to_have_attribute('aria-selected', 'true')

    map_tab = panel.get_by_role('tab', name='지도', exact=True)
    resting_shadow = map_tab.evaluate('e => getComputedStyle(e).boxShadow')
    rect = map_tab.bounding_box()
    assert rect is not None
    page.mouse.move(rect['x'] + rect['width'] / 2, rect['y'] + rect['height'] / 2)
    page.mouse.down()
    assert map_tab.evaluate('e => getComputedStyle(e).boxShadow') != resting_shadow
    page.mouse.up()

    panel.get_by_role('button', name='KAIST 전국 1위').click()
    visit = panel.get_by_role('button', name='KAIST 방문', exact=True)
    menus = menu_metrics(visit)
    visit.click()
    expect(page.get_by_test_id('visit-tag')).to_be_visible()
    page.get_by_role('button', name='상점', exact=True).click()
    back = page.get_by_role('button', name='캠퍼스로 돌아가기')
    menus += menu_metrics(back)
    snapshot(page, path)
    back.click()
    expect(page.get_by_test_id('visit-tag')).to_be_visible()
    return menus


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
            'campusHud': page.locator('.game-campus-score').evaluate('e => getComputedStyle(e).fontFamily'),
            'rankScore': panel.locator('[data-top-rank] .font-press-start').first.evaluate('e => getComputedStyle(e).fontFamily'),
            'list': panel.get_by_role('region', name='학교 목록').evaluate('e => getComputedStyle(e).fontFamily'),
            'search': panel.get_by_role('textbox', name='학교 검색').evaluate('e => getComputedStyle(e).fontFamily'),
            'faces': page.evaluate('''() => [...document.fonts].filter(face => face.family.includes('Maplestory'))
                .map(({weight, status}) => ({weight, status}))'''),
        }
        fonts['consistent'] = all(fonts[key].split(',')[0].strip('\'" ') == 'Maplestory'
                                  for key in ('brand', 'heading', 'campusHud', 'rankScore', 'list', 'search')) \
            and any(face['status'] == 'loaded' for face in fonts['faces'])
        menus = menu_metrics(page.locator('.game-panel-tabs button, .game-center-nav button'))
        assert len(menus) == 8
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
        shop = None
        if (width, height, dpr) == (1440, 900, 1):
            shop = shop_metrics(page, args.out / f'{name}-shop-mock.png')
            page.get_by_role('button', name='캠퍼스로 돌아가기').click()
            regions.get_by_role('button', name='전체', exact=True).click()
            menus += mock_menu_flow(page, panel, args.out / f'{name}-visit-shop.png')
        return {'name': name, 'viewport': viewport, 'dpr': dpr, 'fonts': fonts, 'chips': chips,
                'top3': marker, 'jejuGap': gap, 'mockShop': shop, 'menus': menus}
    finally:
        page.close()


def compact_scope(browser, url):
    for width, height, query, variant in ((390, 844, '?device=full', 'full'), (1440, 900, '?device=framed', 'framed'),
                                          (1023, 720, '', 'full')):
        page = browser.new_page(viewport={'width': width, 'height': height})
        try:
            page.goto(url + query)
            nav = page.get_by_role('navigation', name='주요 메뉴')
            expect(nav).to_be_visible()
            expect(page.locator('[data-desktop-game]')).to_have_count(0)
            expect(page.locator(f'[data-phone-shell="{variant}"]').first).to_be_visible()
            shop = nav.get_by_role('button', name='상점', exact=True)
            assert shop.evaluate('''e => {
                const icon = e.querySelector('svg').getBoundingClientRect();
                const label = document.createRange();
                label.selectNode(e.lastElementChild);
                return icon.height > 0 && icon.bottom <= label.getBoundingClientRect().top + 1;
            }''')
        finally:
            page.close()


def api_manual_tabs(page, panel, calls, sockets):
    school = page.get_by_role('complementary', name='학교 패널')
    detail = school.get_by_role('tab', name='상세')
    chat = school.get_by_role('tab', name='우리 학교 채팅')
    rankings = panel.get_by_role('tab', name='순위')
    detail.focus()
    page.keyboard.press('ArrowRight')
    expect(chat).to_be_focused()
    expect(detail).to_have_attribute('aria-selected', 'true')
    page.keyboard.press('End')
    expect(school.get_by_role('tab', name='방명록')).to_be_focused()
    panel.get_by_role('tab', name='지도').focus()
    page.keyboard.press('ArrowRight')
    expect(rankings).to_be_focused()
    expect(panel.get_by_role('tab', name='지도')).to_have_attribute('aria-selected', 'true')
    # Cross one ranking refresh interval so accidental polling is visible as well as an initial request.
    page.clock.run_for(5100)
    assert not calls and not sockets, (calls, sockets)
    with page.expect_request(lambda req: '/rankings/universities?' in req.url and 'size=20' in req.url):
        page.keyboard.press('Space')
    with page.expect_request(lambda req: '/chat/universities/8/messages' in req.url):
        chat.press('Enter')
    expect(chat).to_have_attribute('aria-selected', 'true')
    expect(school.get_by_role('log')).to_be_visible()
    page.clock.run_for(100)
    assert sockets, 'Activating chat should open its WebSocket'
    detail.click()
    panel.get_by_role('tab', name='지도').click()


def api_shelf(browser, args):
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    profile = {'id': 501, 'nickname': '검증학생', 'email': 'student@example.test', 'role': 'USER', 'status': 'ACTIVE',
               'profileImageUrl': None, 'university': {'id': 8, 'name': '한양대학교', 'logoUrl': None},
               'department': {'id': 1, 'name': '공학과'}, 'clicker': {'level': 1, 'clickPower': 1, 'nextLevelRequiredScore': 200},
               'totalContribScore': 1000, 'totalAttackScore': 0}
    item = {'id': 3, 'name': '테스트 커피', 'content': '검증용 아이템', 'type': 'MULTIPLIER', 'payType': 'CONTRIBUTION',
            'price': 120, 'durationSeconds': 30}
    rank = {'rank': 7, 'universityId': 8, 'name': '한양대학교', 'logoUrl': None, 'totalScore': 1234, 'rankChange': -1}
    calls, sockets = [], []
    data = {'/rankings/universities': {'items': [rank], 'myUniversity': rank, 'hasNext': False, 'page': 0},
            '/chat/universities/8/messages': {'items': [], 'hasNext': False, 'nextCursor': None}, '/alliances/me': None,
            '/auth/reissue': {'accessToken': 'layout-fixture', 'expiresInSeconds': 3600}, '/users/me': profile,
            '/items': [item, {**item, 'id': 4, 'name': '테스트 간식'}], '/items/me/active': None,
            '/map/universities': [], '/clickers': []}

    def fixture(route):
        url = urlsplit(route.request.url)
        path = url.path.removeprefix('/api/v1')
        if (path.startswith('/chat/') or path.endswith('/guestbooks')
                or (path == '/rankings/universities' and 'size=20' in url.query)):
            calls.append(path)
        if path in data:
            route.fulfill(json={'code': 'SUCCESS', 'message': '요청이 성공했습니다.', 'data': data[path]})
        else:
            route.fulfill(status=404, json={'code': 'NOT_FOUND', 'message': 'No desktop test fixture'})

    def socket(ws):
        sockets.append(ws.url)
        ws.on_message(lambda frame: ws.send('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\x00')
                      if isinstance(frame, str) and frame.startswith('CONNECT\n') else None)

    try:
        page.clock.install()
        page.route('**/api/v1/**', fixture)
        page.route_web_socket('**/ws', socket)
        panel = ready(page, args.api_url)
        api_manual_tabs(page, panel, calls, sockets)
        print('PASS API tab focus/activation: no ranking request, guestbook request, or chat connection on focus alone')
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
        compact_scope(browser, args.mock_url)
        print('PASS 1-column and framed modes retain bottom menu with icon above label')
        api = api_shelf(browser, args) if args.api_url else None
        version = browser.version
        browser.close()

    failures = []
    for case in cases:
        for key, passed in (
            ('Maplestory inheritance and loaded face', case['fonts']['consistent']),
            ('raised menus fit in at most two lines with icon on left',
             all(m['fits'] and m['iconLeft'] and m['raised'] and m['height'] >= 44 and 13 <= m['fontSize'] <= 17
                 for m in case['menus'])),
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
