package com.back.nbe1214finalsour.domain.contribution;

import com.back.nbe1214finalsour.global.redis.RedisKey;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.OptionalLong;

@Repository
@RequiredArgsConstructor
public class RedisContributionWallet implements ContributionWallet {


    private static final RedisScript<Long> DEDUCT_SCRIPT =
            RedisScript.of(new ClassPathResource("redis/contribution-deduct.lua"), Long.class);
    private static final RedisScript<Long> RESTORE_SCRIPT =
            RedisScript.of(new ClassPathResource("redis/contribution-restore.lua"), Long.class);

    private final StringRedisTemplate redisTemplate;

    @Override
    public OptionalLong tryDeduct(Long userId, Long universityId, long amount) {
        Long remaining = redisTemplate.execute(
                DEDUCT_SCRIPT,
                List.of(RedisKey.RANK_USER.of(universityId), RedisKey.DIRTY_USER.of()),
                String.valueOf(userId), String.valueOf(amount));

        return (remaining == null || remaining < 0)
                ? OptionalLong.empty()
                : OptionalLong.of(remaining);
    }

    @Override
    public void restore(Long userId, Long universityId, long amount) {
        redisTemplate.execute(
                RESTORE_SCRIPT,
                List.of(RedisKey.RANK_USER.of(universityId), RedisKey.DIRTY_USER.of()),
                String.valueOf(userId), String.valueOf(amount));
    }


}
