-- KEYS[1] rank:univ:{universityId}:user   KEYS[2] dirty:user
-- KEYS[3] user:{userId}:effect             KEYS[4] purchase:{userId}:{idempotencyKey}
-- KEYS[5] user:{userId}:effect:voided (취소된 purchaseId → 그 구매가 꺼낸 이전 효과)
-- ARGV[1] userId  ARGV[2] price  ARGV[3] purchaseId  ARGV[4] 이전 효과 JSON 또는 ""  ARGV[5] 취소 기록 TTL(ms)
-- 반환: 1
redis.call('ZINCRBY', KEYS[1], tonumber(ARGV[2]), ARGV[1])
redis.call('SADD', KEYS[2], ARGV[1])
redis.call('DEL', KEYS[3])
redis.call('DEL', KEYS[4])
return 1
