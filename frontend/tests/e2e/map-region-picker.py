"""Exercise SCRUM-334 in real Chromium layout with deterministic API responses."""

import argparse
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

PROFILE = {'id': 501, 'nickname': '검증 학생', 'email': 'student@example.test', 'role': 'USER', 'status': 'ACTIVE',
           'profileImageUrl': None, 'university': {'id': 8, 'name': '한양대학교', 'logoUrl': None},
           'department': {'id': 1, 'name': '공학과'}, 'clicker': {'level': 1, 'clickPower': 1, 'nextLevelRequiredScore': 200},
           'totalContribScore': 1000, 'totalAttackScore': 0}


def fixture(route):
    path = urlsplit(route.request.url).path.removeprefix('/api/v1')
    details = {'name': '서울대학교', 'logoUrl': None, 'totalScore': 0, 'rank': 1, 'memberCount': 0,
               'topDepartments': [], 'topContributors': [], 'isMyUniversity': False, 'isMyAlly': False, 'rankChange': None}
    data = {'/auth/reissue': {'accessToken': 'test', 'expiresInSeconds': 3600}, '/users/me': PROFILE, '/clickers': [],
            '/items/me/active': None, '/alliances/me': None, '/map/universities': [],
            '/rankings/universities': {'items': [], 'myUniversity': None, 'hasNext': False, 'page': 0, 'size': 20, 'totalCount': 0}}
    if path.startswith('/universities/') and path.count('/') == 2:
        data[path] = {**details, 'id': int(path.split('/')[-1])}
    if path in data:
        route.fulfill(json={'code': 'SUCCESS', 'message': '', 'data': data[path]})
    else:
        route.fulfill(status=404, json={'code': 'NOT_FOUND', 'message': 'Missing fixture'})


def map_scope(page, touch):
    if not touch:
        return page.get_by_role('complementary', name='전국 경쟁 패널')
    page.get_by_role('navigation', name='주요 메뉴').get_by_role('button', name='지도', exact=True).tap()
    page.get_by_role('button', name='전국 지도', exact=True).tap()
    return page


def check_bubble_labels(area):
    labels = area.locator('.game-map-cluster-label')
    expect(labels).to_have_count(9)
    failures = labels.evaluate_all('''labels => labels.flatMap(label => {
        const box = label.getBoundingClientRect();
        const text = label.firstElementChild.getBoundingClientRect();
        const count = label.querySelector('small').getBoundingClientRect();
        const style = getComputedStyle(label);
        const fontSize = parseFloat(style.fontSize);
        const border = parseFloat(style.borderLeftWidth) * box.width / label.offsetWidth;
        const fits = fontSize >= 12 && style.whiteSpace === 'nowrap' && text.left >= box.left + border - 1 &&
            text.right <= box.right - border + 1 && text.top >= box.top && count.bottom <= box.bottom;
        return fits ? [] : [{text: label.textContent, fontSize, box: box.toJSON(), content: text.toJSON()}];
    })''')
    assert not failures, failures
    assert area.evaluate('''area => {
        const jeju = area.querySelector('[data-cluster-region="제주"]').getBoundingClientRect();
        const hint = area.querySelector('.game-map-national-hint, .game-map-pin-caption').getBoundingClientRect();
        return hint.left >= jeju.right || hint.bottom <= jeju.top || hint.top >= jeju.bottom;
    }'''), 'The map hint must not cover Jeju'


def verify(page, url, touch, screenshot):
    page.route('**/api/v1/**', fixture)
    page.goto(url, wait_until='networkidle')
    scope = map_scope(page, touch)
    area = scope.get_by_test_id('map-area')
    toggle = scope.locator('.game-map-region-toggle')
    group = scope.get_by_role('group', name='권역 선택')
    search = scope.get_by_role('textbox', name='학교 검색')

    def activate(button):
        button.tap() if touch else button.press('Enter')

    def choose(region):
        chip = group.get_by_role('button', name=region, exact=True)
        activate(chip)
        expect(toggle).to_have_attribute('aria-expanded', 'true')
        expect(area).to_have_attribute('data-region', region)
        expect(chip).to_have_attribute('aria-pressed', 'true')
        if not touch:
            expect(chip).to_be_focused()

    expect(area).to_have_attribute('data-region', '전체')
    expect(toggle).to_have_accessible_name('지방 선택하기')
    expect(toggle).to_have_accessible_description('현재 권역: 전체')
    expect(group).to_have_count(0)
    page.evaluate('document.fonts.ready')
    check_bubble_labels(area)
    activate(area.get_by_role('button', name='충남·대전 대학 14개, 충청 확대'))
    expect(area).to_have_attribute('data-region', '충청')
    expect(toggle).to_have_attribute('aria-expanded', 'false')
    if not touch:
        expect(toggle).to_be_focused()
    activate(toggle)
    expect(toggle).to_have_accessible_name('지방 숨기기')
    controls = toggle.get_attribute('aria-controls')
    expect(group).to_have_attribute('id', controls)
    expect(group.get_by_role('button')).to_have_count(7)
    assert group.evaluate('''group => {
        const row = group.parentElement.querySelector('[data-testid="map-search-box"]').parentElement.getBoundingClientRect();
        const box = group.getBoundingClientRect();
        const toggle = group.parentElement.querySelector('.game-map-region-toggle').getBoundingClientRect();
        return box.top - row.bottom <= 6 && row.right <= innerWidth && toggle.height >= 44 &&
            [...group.querySelectorAll('button')].every(b => b.getBoundingClientRect().right <= box.right);
    }''')
    choose('전체')
    check_bubble_labels(area)
    if screenshot:
        page.screenshot(path=screenshot, animations='disabled')
    map_top = area.bounding_box()['y']
    search.fill('서울대학교')
    if not touch:
        expect(scope.get_by_test_id('map-search-status')).to_have_text('2개교')
        assert abs(area.bounding_box()['y'] - map_top) <= 1, 'Search feedback moved the map'
    choose('충청')
    expect(search).to_have_value('서울대학교')
    expect(toggle).to_have_accessible_description('현재 권역: 충청')
    choose('전체')
    expect(group).to_have_attribute('id', controls)
    activate(toggle)
    expect(group).to_have_count(0)
    if touch:
        scope.get_by_role('list', name='학교 목록').get_by_text('서울대학교', exact=True).tap()
    else:
        schools = scope.get_by_role('region', name='학교 목록')
        activate(schools.get_by_role('button', name='서울대학교', exact=True))
        expect(schools.get_by_text('서울 · 0점', exact=True)).to_be_visible()
        expect(page.get_by_test_id('visit-tag')).to_have_count(0)
        activate(schools.get_by_role('button', name='서울대학교 방문', exact=True))
    expect(page.get_by_test_id('visit-tag')).to_be_visible()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url')
    parser.add_argument('--chromium')
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium)
        try:
            for width, height, touch in ((1440, 900, False), (1024, 720, False), (320, 740, True), (667, 375, True)):
                page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=touch, reduced_motion='reduce')
                try:
                    verify(page, args.url, touch, args.out / f'{width}x{height}.png' if args.out else None)
                    print(f'PASS {width}×{height}: bubble labels, disclosure, focus, search and visit')
                finally:
                    page.close()
        finally:
            browser.close()


if __name__ == '__main__':
    main()
