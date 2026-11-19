-- KEYS[1] rank:univ:{universityId}:user   KEYS[2] dirty:user
-- KEYS[3] user:{userId}:effect             KEYS[4] purchase:{userId}:{idempotencyKey}
-- KEYS[5] user:{userId}:effect:voided (취소된 purchaseId → 그 구매가 꺼낸 이전 효과)
-- ARGV[1] userId  ARGV[2] price  ARGV[3] purchaseId  ARGV[4] 이전 효과 JSON 또는 ""  ARGV[5] 취소 기록 TTL(ms)
-- 반환: 1
redis.call('ZINCRBY', KEYS[1], tonumber(ARGV[2]), ARGV[1])
redis.call('SADD', KEYS[2], ARGV[1])
if ARGV[4] == '' then
    redis.call('DEL', KEYS[3])
else
    local previous = cjson.decode(ARGV[4])
    local args = {}
    for field, value in pairs(previous) do
        args[#args + 1] = field
        args[#args + 1] = value
    end
    -- 복원 순서: DEL → HSET → PEXPIREAT. 구매 Lua는 DEL 없이 덮어쓰므로, 이전 효과가 배포 전 3필드였다면
    -- DEL 없이 HSET만 할 때 취소된 구매의 purchaseId가 남는다.
    -- cjson.decode는 DEL보다 앞에 둔다: 깨진 JSON이면 효과를 지우기 전에 멈춘다 (Redis는 실행된 명령을 되돌리지 않는다)
    redis.call('DEL', KEYS[3])
    redis.call('HSET', KEYS[3], unpack(args))
    redis.call('PEXPIREAT', KEYS[3], previous['expiredAt'])
end
redis.call('DEL', KEYS[4])
return 1
