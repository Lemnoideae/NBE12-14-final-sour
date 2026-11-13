package com.back.nbe1214finalsour.domain.university.service;

import com.back.nbe1214finalsour.global.redis.RedisHandler;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.OptionalDouble;
import java.util.OptionalLong;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UniversityRankingService {

    private final RedisHandler redisHandler;
    private final RedisTemplate<String, Object> redisTemplate;

    public OptionalLong getUniversityRank(Long universityId) {

        String key = RedisKey.RANK_UNIV.of();

        // Redis에서 학교 점수 가져오기
        var score = redisHandler.getRankScore(key, universityId);

        // 학교 점수가 없는 경우
        if (score.isEmpty()) {
            return OptionalLong.empty();
        }

        double currentScore = score.getAsDouble();

        // 자신보다 점수가 높은 학교 수 계산
        Long higherCount = redisTemplate.opsForZSet()
                .count(
                        key,
                        Math.nextUp(currentScore),
                        Double.POSITIVE_INFINITY
                );

        if (higherCount == null) {
            return OptionalLong.empty();
        }

        return OptionalLong.of(higherCount + 1);
    }

    public OptionalDouble getUniversityScore(Long universityId) {
        String key = RedisKey.RANK_UNIV.of();

        return redisHandler.getRankScore(key, universityId);
    }

    public List<RedisHandler.RankEntry> getTopDepartments(Long universityId) {
        String key = RedisKey.RANK_DEPT.of(universityId);

        return redisHandler.getTopRank(key, 3);
    }

    public List<RedisHandler.RankEntry> getTopContributors(Long universityId) {
        String key = RedisKey.RANK_USER.of(universityId);

        return redisHandler.getTopRank(key, 3);
    }

    public List<RedisHandler.RankEntry> getContributorsRange(Long universityId, long start, long count) {
        return redisHandler.getRankRange(RedisKey.RANK_USER.of(universityId), start, count);
    }

}
