"""Verify the actual rendered service icons with a fixed catalog and clicker level."""

import argparse
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

DRINKS = [('아메리카노', 711, 250, 60), ('에너지 드링크', 208, 1500, 180), ('밤샘 각성제', 850, 5000, 300)]


def verify(page, url, level, desktop, out):
    profile = {'id': 501, 'nickname': '검증 학생', 'email': 'student@example.test', 'role': 'USER', 'status': 'ACTIVE',
               'profileImageUrl': None, 'university': {'id': 8, 'name': '한양대학교', 'logoUrl': None},
               'department': {'id': 1, 'name': '공학과'}, 'clicker': {'level': level, 'clickPower': level,
                                                                 'nextLevelRequiredScore': None if level >= 10 else 200},
               'totalContribScore': 1000, 'totalAttackScore': 0}
    items = [{'id': id_, 'name': name, 'content': '검증용 효과', 'type': 'MULTIPLIER', 'payType': 'CONTRIBUTION',
              'price': price, 'durationSeconds': duration} for name, id_, price, duration in DRINKS]
    items += [{**items[0], 'id': 5, 'name': '새 음료'},
              {**items[0], 'id': 4, 'name': '크레딧 상품', 'payType': 'CREDIT'}]
    data = {'/auth/reissue': {'accessToken': 'test', 'expiresInSeconds': 3600}, '/users/me': profile,
            '/alliances/me': None, '/items': items, '/items/me/active': None, '/map/universities': [],
            '/clickers': [{'level': i, 'clickPower': i, 'requiredScore': 0 if i == 1 else 200} for i in range(1, 12)],
            '/rankings/universities': {'items': [], 'myUniversity': None, 'hasNext': False, 'page': 0,
                                       'size': 20, 'totalCount': 0}}

    def fixture(route):
        path = urlsplit(route.request.url).path.removeprefix('/api/v1')
        if path in data:
            route.fulfill(json={'code': 'SUCCESS', 'message': '', 'data': data[path]})
        else:
            route.fulfill(status=404, json={'code': 'NOT_FOUND', 'message': 'Missing browser fixture'})

    def check_image(container, size):
        image = container.locator('img[alt=""]')
        expect(image).to_be_visible()
        assert image.evaluate('''async (image, size) => {
          await image.decode();
          const box = image.getBoundingClientRect();
          const parent = image.parentElement.getBoundingClientRect();
          return image.naturalWidth > 0 && box.width === size && box.height === size &&
            box.left >= parent.left && box.right <= parent.right && box.bottom <= parent.bottom;
        }''', size), 'Expected a decoded, unclipped decorative sprite at its intended size'
        expect(container.get_by_role('img')).to_have_count(0)
        return image.get_attribute('src')

    page.route('**/api/v1/**', fixture)
    page.goto(url, wait_until='networkidle')
    if desktop:
        stats = page.get_by_role('complementary', name='학교 패널').get_by_role('tabpanel', name='상세')
    else:
        page.get_by_test_id('campus-stats-button').tap()
        stats = page.get_by_role('dialog', name='상세 스탯')
    label = stats.get_by_text(f'클리커 Lv.{level}', exact=True)
    expect(label).to_be_visible()
    stats_art = check_image(label, 24) if level <= 10 else None
    if stats_art is None:
        expect(label.locator('img')).to_have_count(0)
        expect(label.locator('svg[aria-hidden="true"]')).to_have_count(1)
    if out:
        stats.screenshot(path=out / 'stats.png', animations='disabled')
    if not desktop:
        page.keyboard.press('Escape')
        expect(stats).to_be_hidden()

    shop_button = page.get_by_role('button', name='상점', exact=True)
    shop_button.press('Enter') if desktop else shop_button.tap()
    shop = page.get_by_role('region', name='서버 아이템 상점')
    clicker = page.get_by_text('내 클리커 강화 제단', exact=True).locator('xpath=ancestor::div[contains(@class, "rpg-box")][1]')
    if stats_art is not None:
        assert check_image(clicker, 48) == stats_art, 'Both surfaces must use the art for the same level'
    else:
        expect(clicker.locator('img')).to_have_count(0)
        expect(clicker.locator('svg[aria-hidden="true"]')).to_have_count(1)
    urls = [check_image(shop.get_by_role('button', name=f'{name} 구매 선택'), 24) for name, *_ in DRINKS]
    assert len(set(urls)) == 3, urls
    for name in ['새 음료 구매 선택', '크레딧 상품 구매 준비 중']:
        card = shop.get_by_role('button', name=name)
        expect(card.locator('svg[aria-hidden="true"]')).to_have_count(1)
        expect(card.locator('img')).to_have_count(0)
    if out:
        shop.screenshot(path=out / 'shelf.png', animations='disabled')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Unexpected horizontal page scroll'
    print(f'PASS {page.viewport_size} Lv.{level}: stats, altar, distinct drinks and accessible fallbacks')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url')
    parser.add_argument('--chromium')
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium)
        cases = [(1440, 900, i, True) for i in [1, 5, 10]] + [(320, 740, i, False) for i in [1, 5, 10]]
        cases += [(390, 844, 11, False), (667, 375, 5, False)]
        for width, height, level, desktop in cases:
            page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=not desktop, reduced_motion='reduce')
            try:
                out = args.screenshots / f'{width}x{height}-lv{level:02}' if args.screenshots else None
                if out:
                    out.mkdir(parents=True, exist_ok=True)
                verify(page, args.url, level, desktop, out)
            finally:
                page.close()
        browser.close()
