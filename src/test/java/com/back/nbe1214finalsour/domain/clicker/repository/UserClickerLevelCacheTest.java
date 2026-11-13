package com.back.nbe1214finalsour.domain.clicker.repository;

import com.back.nbe1214finalsour.IntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
public class UserClickerLevelCacheTest {

    private static final Long USER_ID = 900_10L;
    private static final String KEY = "user:" + USER_ID + ":clicker";

    @Autowired
    private UserClickerLevelCache userClickerLevelCache;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @AfterEach
    public void tearDown() {
        redisTemplate.delete(KEY);
    }

    private String cachedLevel(){
        return redisTemplate.opsForValue().get(KEY);
    }

    @Test
    @DisplayName("캐시가 없으면 새 레벨을 평문 숫자로 저장")
    void raiseLevel_whenEmpty() {
        userClickerLevelCache.raiseLevel(USER_ID, 2L);
        assertThat(cachedLevel()).isEqualTo("2");
    }

    @Test
    @DisplayName("새 레벨이 더 높으면 갱신")
    void raiseLevel_whenHigher() {
        redisTemplate.opsForValue().set(KEY, "2");

        userClickerLevelCache.raiseLevel(USER_ID, 3L);

        assertThat(cachedLevel()).isEqualTo("3");
    }

}
