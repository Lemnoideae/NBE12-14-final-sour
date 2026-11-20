package com.back.nbe1214finalsour.domain.click.service;

import com.back.nbe1214finalsour.domain.alliance.entity.Alliance;
import com.back.nbe1214finalsour.domain.alliance.entity.AllianceMatch;
import com.back.nbe1214finalsour.domain.alliance.repository.AllianceMatchRepository;
import com.back.nbe1214finalsour.domain.alliance.repository.AllianceRepository;
import com.back.nbe1214finalsour.domain.alliance.service.AllianceAllyChecker;
import com.back.nbe1214finalsour.domain.click.dto.AssistRequest;
import com.back.nbe1214finalsour.domain.click.dto.AssistResponse;
import com.back.nbe1214finalsour.domain.university.repository.UniversityCache;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.redis.RedisHandler;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

/**
 * 연합 학교 지원 (추가 명세 §3-3, 결정 7, SCRUM-187).
 *
 * <p>대상 학교 +⌊base × 0.3⌋, 내 기여도 +⌊base × 아이템 배율⌋ (base = clickCount × clickPower). 내 학교·학과 점수는
 * 그대로다. 도서관 보너스는 내 학교 도서관 위치 보너스라 적용하지 않는다. 대결 점수는 클릭도 아직 쌓는 곳이 없어 반영하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class AssistService {

    private static final RedisScript<List> APPLY_ASSIST =
            RedisScript.of(new ClassPathResource("redis/apply-assist.lua"), List.class);

    private final ClickActionGuard clickActionGuard;
    private final StringRedisTemplate stringRedisTemplate;
    private final RedisHandler redisHandler;
    private final UniversityCache universityCache;
    private final AllianceAllyChecker allianceAllyChecker;
    private final AllianceRepository allianceRepository;
    private final AllianceMatchRepository allianceMatchRepository;

    public AssistResponse assist(Long userId, Long universityId, AssistRequest request) {
        int clickCount = request.clickCount();
        Long targetUniversityId = request.targetUniversityId();

        // 공격과 같이 대상 검증을 먼저 한다. 거절된 요청은 제출 ID와 요청 한도를 쓰지 않는다
        if (universityId.equals(targetUniversityId)) {
            throw new BusinessException(ErrorCode.ASSIST_NOT_ALLY, "내 학교 지원 userId=" + userId);
        }
        String targetName = universityCache.getName(targetUniversityId);
        if (!allianceAllyChecker.areAllies(universityId, targetUniversityId)) {
            throw new BusinessException(ErrorCode.ASSIST_NOT_ALLY,
                    "동맹 아님 userId=" + userId + ", target=" + targetUniversityId);
        }

        long base = clickActionGuard.verifyAndGetBaseScore(userId, request.submissionId(), clickCount);
        long assistScore = base * 3 / 10;
        BigDecimal itemMultiplier = BigDecimal.valueOf(redisHandler.getHash(RedisKey.USER_EFFECT.of(userId), "multiplier", Double.class)
                .orElse(1.0));
        long contribScore = itemMultiplier.multiply(BigDecimal.valueOf(base))
                .setScale(0, RoundingMode.FLOOR).longValueExact();

        // 연합 점수
        String stringAllianceId = stringRedisTemplate.opsForValue().get(RedisKey.UNIV_ALLIANCE.of(targetUniversityId));
        Long allianceId = 0L;
        if (stringAllianceId == null) {
            Alliance alliance = allianceRepository.findCurrentByUniversityId(targetUniversityId, OffsetDateTime.now())
                    .orElse(null);
            if (alliance != null) {
                stringRedisTemplate.opsForValue().set(RedisKey.UNIV_ALLIANCE.of(targetUniversityId),
                        String.valueOf(alliance.getId()),
                        Duration.between(OffsetDateTime.now(), alliance.getExpiredAt()));
                allianceId = alliance.getId();
            } else {
                stringRedisTemplate.opsForValue()
                        .set(RedisKey.UNIV_ALLIANCE.of(targetUniversityId), "none", Duration.ofSeconds(10));
            }
        } else if (!stringAllianceId.equals("none")) {
            allianceId = Long.parseLong(stringAllianceId);
        }

        // 대결 점수
        Long matchId = 0L;
        String team = "";
        if (allianceId != 0L) {
            String matchResult = stringRedisTemplate.opsForValue().get(RedisKey.UNIV_MATCH.of(targetUniversityId));
            if (matchResult == null) {
                AllianceMatch match = allianceMatchRepository.findByAllianceId(allianceId, OffsetDateTime.now())
                        .orElse(null);

                if (match != null) {
                    team = match.getAllianceAId().equals(allianceId) ? "A" : "B";
                    stringRedisTemplate.opsForValue()
                            .set(RedisKey.UNIV_MATCH.of(targetUniversityId), match.getId() + ":" + team, Duration.between(OffsetDateTime.now(), match.getEndedAt()));
                    matchId = match.getId();
                } else {
                    stringRedisTemplate.opsForValue()
                            .set(RedisKey.UNIV_MATCH.of(targetUniversityId), "none", Duration.ofSeconds(10));
                }
            } else if (!matchResult.equals("none")) {
                String[] split = matchResult.split(":");
                matchId = Long.parseLong(split[0]);
                team = split[1];
            }
        }

        List<String> r = stringRedisTemplate.execute(
                APPLY_ASSIST,
                List.of(RedisKey.RANK_UNIV.of(), RedisKey.RANK_USER.of(universityId),
                        RedisKey.DIRTY_UNIV.of(), RedisKey.DIRTY_USER.of(),
                        RedisKey.ALLIANCE_SCORE.of(allianceId), RedisKey.MATCH_SCORE.of(matchId)),
                String.valueOf(targetUniversityId),
                String.valueOf(assistScore),
                String.valueOf(userId),
                String.valueOf(contribScore),
                String.valueOf(allianceId),
                team
        );
        return new AssistResponse(
                (long) clickCount,
                assistScore,
                new AssistResponse.AssistUniversityResponse(targetUniversityId, targetName,
                        Long.valueOf(r.get(0)), Long.valueOf(r.get(1))),
                Long.valueOf(r.get(2)));
    }
}
