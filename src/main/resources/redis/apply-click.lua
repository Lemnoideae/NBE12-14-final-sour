-- KEYS[1] rank:univ                     학교 점수 ZSET
-- KEYS[2] rank:univ:{u}:dept            학과 점수 ZSET
-- KEYS[3] rank:univ:{u}:user            개인 기여도 ZSET
-- KEYS[4] dirty:univ   KEYS[5] dirty:dept   KEYS[6] dirty:user
-- KEYS[7] clicks:univ:{u}:{nowSec}      이번 초 학교 클릭 수
-- KEYS[8] clicks:univ:{u}:{nowSec-1}    직전 1초 학교 클릭 수
-- ARGV[1] universityId  ARGV[2] departmentId  ARGV[3] userId
-- ARGV[4] earnedScore (정수)  ARGV[5] clickCount

local earned = tonumber(ARGV[4])

local univTotal = redis.call('ZINCRBY', KEYS[1], earned, ARGV[1])
local deptTotal = redis.call('ZINCRBY', KEYS[2], earned, ARGV[2])
local myContrib = redis.call('ZINCRBY', KEYS[3], earned, ARGV[3])

-- 1분 배치가 바뀐 대상만 DB에 쓰도록 표시
redis.call('SADD', KEYS[4], ARGV[1])
redis.call('SADD', KEYS[5], ARGV[2])
redis.call('SADD', KEYS[6], ARGV[3])

-- 초 단위 학교 클릭 수 (연출용이라 몇 초 뒤 사라져도 됨)
redis.call('INCRBY', KEYS[7], ARGV[5])
redis.call('EXPIRE', KEYS[7], 5)

local univRank = redis.call('ZREVRANK', KEYS[1], ARGV[1])   -- 0부터 시작
local lastSecond = redis.call('GET', KEYS[8]) or '0'

return { univTotal, deptTotal, myContrib, tostring(univRank + 1), lastSecond }