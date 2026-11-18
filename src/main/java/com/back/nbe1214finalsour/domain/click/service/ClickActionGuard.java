package com.back.nbe1214finalsour.domain.click.service;

import com.back.nbe1214finalsour.domain.abuse.service.AbuseVerificationService;
import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import com.back.nbe1214finalsour.domain.clicker.service.ClickerService;
import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.domain.user.entity.UserStatus;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.domain.user.repository.UserStatusCache;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class ClickActionGuard {

    private final StringRedisTemplate stringRedisTemplate;
    private final UserStatusCache userStatusCache;
    private final UserRepository userRepository;
    private final ActionRateLimiter actionRateLimiter;
    private final ClickCountLimiter clickCountLimiter;
    private final ClickerService clickerService;
    private final AbuseVerificationService abuseVerificationService;

    public long verifyAndGetBaseScore(Long userId, String submissionId, int clickCount) {
        try {
            checkActive(userId);
            // 어뷰징 의심 표시가 있으면 봇 확인 전까지 막는다 (SCRUM-118). 중복 제출 확인보다 앞이라 막힌 요청은 submissionId를 쓰지 않는다
            abuseVerificationService.requireNotFlagged(userId);
            checkDuplicate(userId, submissionId);
            actionRateLimiter.check(userId);
            clickCountLimiter.check(userId, clickCount);
        } catch (BusinessException e) {
            // 한도 초과를 어뷰징 의심 신호로 쓴다 (SCRUM-118). 넘은 요청 자체는 지금처럼 429
            if (e.getErrorCode() == ErrorCode.CLICK_TOO_FREQUENT || e.getErrorCode() == ErrorCode.CLICK_COUNT_EXCEEDED) {
                abuseVerificationService.flag(userId);
            }
            throw e;
        }
        return loadBaseScore(userId, clickCount);
    }

    private Long loadBaseScore(Long userId, int clickCount) {
        long score = clickCount;

        // 클리커 데미지 가져오기
        String clickerLevel = stringRedisTemplate.opsForValue().get(RedisKey.USER_CLICKER.of(userId));

        // 회원은 레벨 캐시가 없을 때만 DB에서 읽는다
        if (clickerLevel == null) {
            User user = userRepository.findById(userId).orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
            // 레디스에 정보가 없으면 레디스에 저장
            stringRedisTemplate.opsForValue().set(RedisKey.USER_CLICKER.of(userId), String.valueOf(user.getClickerId()));
            clickerLevel = String.valueOf(user.getClickerId());
        }

        Clicker clicker = clickerService.getClickerById(Long.valueOf(clickerLevel));

        score *= clicker.getClickPower();

        return score;
    }

    private boolean checkActive(Long userId) {
        UserStatus userStatus = userStatusCache.find(userId).orElse(null);
        if (userStatus == null) {
            User user = userRepository.findById(userId).orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
            userStatus = userStatusCache.fillIfAbsent(userId, user.getStatus());
        }
        if (userStatus != UserStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.USER_SUSPENDED);
        }
        return true;
    }

    private void checkDuplicate(Long userId, String submissionId) {
        if (Boolean.FALSE.equals(stringRedisTemplate.opsForValue()
                .setIfAbsent(RedisKey.SUBMIT_DEDUPE.of(userId, submissionId), submissionId, Duration.ofSeconds(10L)))) {
            throw new BusinessException(ErrorCode.CLICK_DUPLICATE_SUBMISSION);
        }
    }
}
