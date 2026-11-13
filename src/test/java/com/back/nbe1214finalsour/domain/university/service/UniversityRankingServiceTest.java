package com.back.nbe1214finalsour.domain.university.service;

import com.back.nbe1214finalsour.global.redis.RedisHandler;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;

import java.util.List;
import java.util.OptionalDouble;
import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class UniversityRankingServiceTest {

    @Mock
    private RedisHandler redisHandler;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private ZSetOperations<String, Object> zSetOperations;

    @InjectMocks
    private UniversityRankingService universityRankingService;

    @Test
    @DisplayName("학교보다 점수가 높은 학교가 2개면 3위를 반환한다")
    void getUniversityRank() {

        Long universityId = 12L;
        String key = RedisKey.RANK_UNIV.of();

        given(redisHandler.getRankScore(key, universityId))
                .willReturn(OptionalDouble.of(8000.0));

        given(redisTemplate.opsForZSet())
                .willReturn(zSetOperations);

        given(zSetOperations.count(
                key,
                Math.nextUp(8000.0),
                Double.POSITIVE_INFINITY
        )).willReturn(2L);

        OptionalLong result =
                universityRankingService.getUniversityRank(universityId);

        assertThat(result).isPresent();
        assertThat(result.getAsLong()).isEqualTo(3L);

        verify(redisHandler).getRankScore(key, universityId);
    }

    @Test
    @DisplayName("동점 학교가 있어도 자신보다 높은 점수만 계산한다")
    void getUniversityRank_tie() {

        Long universityId = 9L;
        String key = RedisKey.RANK_UNIV.of();

        given(redisHandler.getRankScore(key, universityId))
                .willReturn(OptionalDouble.of(8000.0));

        given(redisTemplate.opsForZSet())
                .willReturn(zSetOperations);

        given(zSetOperations.count(
                key,
                Math.nextUp(8000.0),
                Double.POSITIVE_INFINITY
        )).willReturn(1L);

        OptionalLong result =
                universityRankingService.getUniversityRank(universityId);

        assertThat(result).isPresent();
        assertThat(result.getAsLong()).isEqualTo(2L);
    }

    @Test
    @DisplayName("Redis에 학교 점수가 없으면 빈 결과를 반환한다")
    void getUniversityRank_noScore() {

        Long universityId = 999L;
        String key = RedisKey.RANK_UNIV.of();

        given(redisHandler.getRankScore(key, universityId))
                .willReturn(OptionalDouble.empty());

        OptionalLong result =
                universityRankingService.getUniversityRank(universityId);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Redis에 학교 점수가 있으면 해당 점수를 반환한다")
    void getUniversityScore() {

        Long universityId = 12L;
        String key = RedisKey.RANK_UNIV.of();

        given(redisHandler.getRankScore(key, universityId))
                .willReturn(OptionalDouble.of(15000.0));

        OptionalDouble result =
                universityRankingService.getUniversityScore(universityId);

        assertThat(result).isPresent();
        assertThat(result.getAsDouble()).isEqualTo(15000.0);

        verify(redisHandler).getRankScore(key, universityId);
    }

    @Test
    @DisplayName("Redis에 학교 점수가 없으면 빈 결과를 반환한다")
    void getUniversityScore_empty() {

        Long universityId = 999L;
        String key = RedisKey.RANK_UNIV.of();

        given(redisHandler.getRankScore(key, universityId))
                .willReturn(OptionalDouble.empty());

        OptionalDouble result =
                universityRankingService.getUniversityScore(universityId);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Redis에서 학교별 점수 상위 학과 3개를 조회한다")
    void getTopDepartments() {

        Long universityId = 12L;
        String key = RedisKey.RANK_DEPT.of(universityId);

        List<RedisHandler.RankEntry> departments = List.of(
                new RedisHandler.RankEntry(301L, 5000.0),
                new RedisHandler.RankEntry(302L, 4000.0),
                new RedisHandler.RankEntry(303L, 3000.0)
        );

        given(redisHandler.getTopRank(key, 3))
                .willReturn(departments);

        List<RedisHandler.RankEntry> result =
                universityRankingService.getTopDepartments(universityId);

        assertThat(result).hasSize(3);

        assertThat(result)
                .extracting(RedisHandler.RankEntry::member)
                .containsExactly(301L, 302L, 303L);

        assertThat(result.get(0).score()).isEqualTo(5000.0);

        verify(redisHandler).getTopRank(key, 3);
    }

    @Test
    @DisplayName("Redis에서 학교별 기여도 상위 사용자 3명을 조회한다")
    void getTopContributors() {

        Long universityId = 12L;
        String key = RedisKey.RANK_USER.of(universityId);

        List<RedisHandler.RankEntry> contributors = List.of(
                new RedisHandler.RankEntry(101L, 9000.0),
                new RedisHandler.RankEntry(102L, 7000.0),
                new RedisHandler.RankEntry(103L, 5000.0)
        );

        given(redisHandler.getTopRank(key, 3))
                .willReturn(contributors);

        List<RedisHandler.RankEntry> result =
                universityRankingService.getTopContributors(universityId);

        assertThat(result).hasSize(3);

        assertThat(result)
                .extracting(RedisHandler.RankEntry::member)
                .containsExactly(101L, 102L, 103L);

        assertThat(result.get(0).score()).isEqualTo(9000.0);

        verify(redisHandler).getTopRank(key, 3);
    }

    @Test
    @DisplayName("다음 기여자 구간은 개인 순위 키로 조회한다")
    void getContributorsRange() {
        String key = RedisKey.RANK_USER.of(12L);
        var expected = List.of(new RedisHandler.RankEntry(104L, 500.0));
        given(redisHandler.getRankRange(key, 3, 3)).willReturn(expected);

        assertThat(universityRankingService.getContributorsRange(12L, 3, 3))
                .isEqualTo(expected);
        verify(redisHandler).getRankRange(key, 3, 3);
    }

}
