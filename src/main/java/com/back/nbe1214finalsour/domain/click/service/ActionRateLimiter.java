package com.back.nbe1214finalsour.domain.click.service;

import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class ActionRateLimiter {

    private StringRedisTemplate stringRedisTemplate;

    private final RedisScript<Long> INCR_WITH_TTL = RedisScript.of("""
            local c = redis.call('INCR', KEYS[1])
            if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            return c
            """, Long.class);

    private final int MAX_ACTIONS_PER_WINDOW = 12;
    private final int WINDOW_SECONDS = 10;


    public void check(Long userId) {
        Long count = stringRedisTemplate.execute(
                INCR_WITH_TTL,
                List.of(RedisKey.RATELIMIT_ACTION.of(userId)),
                String.valueOf(WINDOW_SECONDS));

        if (count != null && count > MAX_ACTIONS_PER_WINDOW) {
            throw new BusinessException(ErrorCode.CLICK_TOO_FREQUENT);
        }
    }
}
