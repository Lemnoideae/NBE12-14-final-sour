-- 클리커 업그레이드: 기여도 차감, 레벨 +1, 변경 표시를 한 번에 처리한다.
-- KEYS[1]: rank:univ:{universityId}:user (교내 개인 순위 ZSet, score = 기여도)
-- KEYS[2]: dirty:user (1분 배치가 기여도를 DB에 반영할 유저 ID 모음)
-- KEYS[3]: user:{userId}:clicker (레벨 원본)
-- KEYS[4]: dirty:clicker (1분 배치가 레벨을 DB에 반영할 유저 ID 모음)
-- ARGV[1]: userId
-- ARGV[2]: 비용
-- ARGV[3]: 기대 레벨 (12단계에서 비교 추가)
-- 반환: 차감 후 잔액

local remaining = redis.call('ZINCRBY', KEYS[1], -tonumber(ARGV[2]), ARGV[1])
redis.call('SADD', KEYS[2], ARGV[1])
redis.call('INCR', KEYS[3])
redis.call('SADD', KEYS[4], ARGV[1])
return tonumber(remaining)
