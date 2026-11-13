package com.back.nbe1214finalsour.domain.clicker.repository;

import com.back.nbe1214finalsour.global.redis.RedisKey;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Repository;

import java.util.List;

// 클릭 엔진이 클릭 세기를 계산할 때 읽는 회원 레벨 캐시 (원본은 DB users.clicker_id)
@Repository
@RequiredArgsConstructor
public class UserClickerLevelCache {
    private static final RedisScript<Long> RAISE_SCRIPT =
            RedisScript.of(new ClassPathResource("redis/clicker-level-redis.lua"), Long.class);

    private final StringRedisTemplate redisTemplate;

    // 현재 캐시 값보다 클 때만 갱신 (늦게 도착한 낮은 레벨은 무시)
    public void raiseLevel(Long userId, Long level) {
        redisTemplate.execute(
                RAISE_SCRIPT,
                List.of(RedisKey.USER_CLICKER.of(userId)),
                String.valueOf(level)
        );
    }
}
