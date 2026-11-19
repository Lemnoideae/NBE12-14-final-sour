package com.back.nbe1214finalsour.domain.item.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class RedisPotionPurchaser {

    private final StringRedisTemplate redisTemplate;

    public PotionPurchaseOutcome purchase(Long userId, Long universityId, Long itemId, long price,
                                          double multiplier, OffsetDateTime expiredAt, UUID idempotencyKey) {
        return null;
    }
}
