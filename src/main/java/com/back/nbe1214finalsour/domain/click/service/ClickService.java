package com.back.nbe1214finalsour.domain.click.service;

import com.back.nbe1214finalsour.domain.click.dto.ClickRequest;
import com.back.nbe1214finalsour.domain.clicker.service.ClickerService;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class ClickService {

    private final StringRedisTemplate stringRedisTemplate;
    private final ActionRateLimiter actionRateLimiter;
    private final ClickerService clickerService;

    public void click(Long userId, ClickRequest request) {

        int clickCount = request.clickCount();
        String submissionId = request.submissionId();

        // 1. 중복 제출 확인 및 저장
        Boolean isRequested = stringRedisTemplate.opsForValue().setIfAbsent(RedisKey.SUBMIT_DEDUPE.of(userId, submissionId), submissionId, Duration.ofSeconds(10L));

        // 위에서 저장이 안됐으면 중복 요청임
        if (Boolean.FALSE.equals(isRequested)) {
            throw new BusinessException(ErrorCode.CLICK_DUPLICATE_SUBMISSION);
        }

        // 2. 횟수·간격 검증 (클릭·공격·지원 모두 합쳐서 10초에 12회 요청이 왔는가?)
        actionRateLimiter.check(userId);

        // 3. 인정 점수
        clickerService.getLevelTable();

        // 4. Redis에 반영


    }
}
