package com.back.nbe1214finalsour.domain.clicker.repository;

import com.back.nbe1214finalsour.IntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
public class RedisClickerUpgraderTest {

    private static final Long USER_ID = 900_020L;
    private static final Long UNIVERSITY_ID = 900_020L;
    private static final String RANK_KEY = "rank:univ:" + UNIVERSITY_ID + ":user";
    private static final String LEVEL_KEY = "user:" + USER_ID + ":clicker";
    private static final String DIRTY_USER_KEY = "dirty:user";
    private static final String DIRTY_CLICKER_KEY = "dirty:clicker";

    @Autowired
    private RedisClickerUpgrader clickerUpgrader;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @BeforeEach
    void setUp() {
        // 교내 기여도 1000점, 클리커 레벨 1
        redisTemplate.opsForZSet().add(RANK_KEY, USER_ID.toString(), 1000);
        redisTemplate.opsForValue().set(LEVEL_KEY, "1");
    }

    @AfterEach
    void tearDown() {
        // Redis는 @Transactional 롤백 대상이 아니라 직접 지운다 (공용 집합은 이 유저만 뺀다)
        redisTemplate.delete(RANK_KEY);
        redisTemplate.delete(LEVEL_KEY);
        redisTemplate.opsForSet().remove(DIRTY_USER_KEY, USER_ID.toString());
        redisTemplate.opsForSet().remove(DIRTY_CLICKER_KEY, USER_ID.toString());
    }

    @Test
    @DisplayName("기대 레벨이 맞고 잔액이 충분하면 차감, 레벨 +1, dirty 표시 2개, 잔액 반환을 한 번에 한다")
    void upgrade_success() {
        // given (setUp: 기여도 1000, 레벨 1)

        // when
        long result = clickerUpgrader.upgrade(USER_ID, UNIVERSITY_ID, 1L, 300L);

        // then
        assertThat(result).isEqualTo(700L);
        assertThat(redisTemplate.opsForZSet().score(RANK_KEY, USER_ID.toString())).isEqualTo(700.0);
        assertThat(redisTemplate.opsForValue().get(LEVEL_KEY)).isEqualTo("2");
        assertThat(isMember(DIRTY_USER_KEY)).isTrue();
        assertThat(isMember(DIRTY_CLICKER_KEY)).isTrue();
    }

    private boolean isMember(String setKey) {
        return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(setKey, USER_ID.toString()));
    }
}
