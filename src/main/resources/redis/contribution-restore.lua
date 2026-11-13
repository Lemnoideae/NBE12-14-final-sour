-- 차감했던 기여도를 되돌린다.
-- KEYS[1]: rank:univ:{universityId}:user
-- KEYS[2]: dirty:user
-- ARGV[1]: userId
-- ARGV[2]: 복구액

redis.call('ZINCRBY', KEYS[1], ARGV[2], ARGV[1])
redis.call('SADD', KEYS[2], ARGV[1])
return 1