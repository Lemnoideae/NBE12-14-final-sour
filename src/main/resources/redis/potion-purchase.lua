-- KEYS[1] rank:univ:{universityId}:user   KEYS[2] dirty:user
-- KEYS[3] user:{userId}:effect             KEYS[4] purchase:{userId}:{idempotencyKey}
-- ARGV[1] userId  ARGV[2] price  ARGV[3] itemId  ARGV[4] multiplier
-- ARGV[5] expiredAt(epoch ms)  ARGV[6] purchaseId  ARGV[7] 멱등 키 TTL(ms)
-- 반환: {차감 후 잔액, 이전 효과 JSON 또는 ""}
local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
local amount = tonumber(ARGV[2])
if not score or tonumber(score) < amount then
    return {-1}
end
redis.call('SET', KEYS[4], '1', 'PX', ARGV[7])
local remaining = redis.call('ZINCRBY', KEYS[1], -amount, ARGV[1])
redis.call('SADD', KEYS[2], ARGV[1])
local raw = redis.call('HGETALL', KEYS[3])
local previous = ''
if #raw > 0 then
    local fields = {}
    for i = 1, #raw, 2 do fields[raw[i]] = raw[i + 1] end
    previous = cjson.encode(fields)
end
redis.call('HSET', KEYS[3], 'itemId', ARGV[3], 'multiplier', ARGV[4], 'expiredAt', ARGV[5], 'purchaseId', ARGV[6])
redis.call('PEXPIREAT', KEYS[3], ARGV[5])
return {tonumber(remaining), previous}
