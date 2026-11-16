package com.back.nbe1214finalsour.domain.click.service;

import com.back.nbe1214finalsour.domain.click.dto.ClickApplyResponse;
import com.back.nbe1214finalsour.domain.click.dto.ClickRequest;
import com.back.nbe1214finalsour.domain.click.dto.ClickResponse;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.redis.RedisHandler;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ClickService {

    private final StringRedisTemplate stringRedisTemplate;
    private final UserRepository userRepository;
    private final RedisHandler redisHandler;
    private final ClickActionGuard clickActionGuard;

    private static final RedisScript<List> APPLY_CLICK = RedisScript.of(new ClassPathResource("redis/apply-click.lua"), List.class);

    /**
     * @param universityId 토큰의 학교 ID
     * @param departmentId 토큰의 학과 ID. {@code null}이면(학과 claim을 넣기 전에 발급된 토큰) DB 값을 쓴다
     */
    public ClickResponse click(Long userId, Long universityId, Long departmentId, ClickRequest request) {
        int clickCount = request.clickCount();
        String submissionId = request.submissionId();

        long score = clickActionGuard.verifyAndGetBaseScore(userId, submissionId, clickCount);

        if (departmentId == null) {
            departmentId = userRepository.findById(userId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND))
                    .getDepartmentId();
        }

        // 아이템 적용 가져오기
        Double multiplier = redisHandler.getHash(RedisKey.USER_EFFECT.of(userId), "multiplier", Double.class)
                .orElse(1.0);
        score = (long) Math.floor(score * multiplier);

        // 4. Redis에 반영
        long nowSec = Instant.now().getEpochSecond();
        List<String> keys = List.of(
                RedisKey.RANK_UNIV.of(),
                RedisKey.RANK_DEPT.of(universityId),
                RedisKey.RANK_USER.of(universityId),
                RedisKey.DIRTY_UNIV.of(),
                RedisKey.DIRTY_DEPT.of(),
                RedisKey.DIRTY_USER.of(),
                RedisKey.CLICKS_UNIV_SECOND.of(universityId, nowSec),
                RedisKey.CLICKS_UNIV_SECOND.of(universityId, nowSec - 1)
        );

        List<String> r = stringRedisTemplate.execute(
                APPLY_CLICK,
                keys,
                String.valueOf(universityId),
                String.valueOf(departmentId),
                String.valueOf(userId),
                String.valueOf(score),
                String.valueOf(clickCount)
        );
        ClickApplyResponse clickApplyResponse = new ClickApplyResponse(
                Long.valueOf(r.get(0)),
                Long.valueOf(r.get(1)),
                Long.valueOf(r.get(2)),
                Long.valueOf(r.get(3)),
                Long.valueOf(r.get(4)));

        return ClickResponse.from(clickApplyResponse, clickCount, score, multiplier, universityId, departmentId);
    }
}
