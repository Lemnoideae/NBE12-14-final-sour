-- 기여도 잔액 확인과 차감을 원자적으로 처리한다.
-- KEYS[1]: rank:univ:{universityId}:user (교내 개인 순위 ZSet, score = 기여도)
-- KEYS[2]: dirty:user (1분 배치가 DB에 반영할 유저 ID 모음)
-- ARGV[1]: userId
-- ARGV[2]: 차감액
-- 반환: 차감 후 잔액, 잔액이 부족하거나 ZSet에 없으면 -1

local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not score then
    return -1
end

local amount = tonumber(ARGV[2])
if tonumber(score) < amount then
    return -1
end

local remaining = redis.call('ZINCRBY', KEYS[1], -amount, ARGV[1])
redis.call('SADD', KEYS[2], ARGV[1])
return tonumber(remaining)