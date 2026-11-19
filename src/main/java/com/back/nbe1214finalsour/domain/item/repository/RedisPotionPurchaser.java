package com.back.nbe1214finalsour.domain.item.repository;

import com.back.nbe1214finalsour.global.redis.RedisKey;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class RedisPotionPurchaser {

    private static final long DEDUPE_TTL_MILLIS = Duration.ofMinutes(5).toMillis();

    @SuppressWarnings("rawtypes")
    private static final RedisScript<List> PURCHASE_SCRIPT =
            RedisScript.of(new ClassPathResource("redis/potion-purchase.lua"), List.class);

    private final StringRedisTemplate redisTemplate;

    @SuppressWarnings("rawtypes")
    public PotionPurchaseOutcome purchase(Long userId, Long universityId, Long itemId, long price,
                                          double multiplier, OffsetDateTime expiredAt, UUID idempotencyKey) {
        List result = redisTemplate.execute(
                PURCHASE_SCRIPT,
                List.of(
                        RedisKey.RANK_USER.of(universityId),
                        RedisKey.DIRTY_USER.of(),
                        RedisKey.USER_EFFECT.of(userId),
                        RedisKey.PURCHASE_DEDUPE.of(userId, idempotencyKey)),
                String.valueOf(userId),
                String.valueOf(price),
                String.valueOf(itemId),
                String.valueOf(multiplier),
                String.valueOf(expiredAt.toInstant().toEpochMilli()),
                idempotencyKey.toString(),
                String.valueOf(DEDUPE_TTL_MILLIS));
        return new PotionPurchaseOutcome((Long) result.get(0), result.size() > 1 ? (String) result.get(1) : "");
    }

    public void compensate(Long userId, Long universityId, long price, UUID idempotencyKey, String previousEffect) {
    }
}
