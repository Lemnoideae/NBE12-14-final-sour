-- 클릭 엔진용 회원 레벨 캐시를 현재 값보다 클 때만 갱신한다.
-- 레벨은 올라가기만 하므로, 커밋 후 처리 순서가 뒤집혀 늦게 도착한 낮은 레벨은 무시한다.
-- KEYS[1]: user:{userId}:clicker
-- ARGV[1]: 새 레벨
-- 반환: 갱신했으면 1, 무시했으면 0

local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
    return 0
end
redis.call('SET', KEYS[1], ARGV[1])
return 1