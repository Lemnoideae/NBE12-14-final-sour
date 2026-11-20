package com.back.nbe1214finalsour.domain.click.service;

import com.back.nbe1214finalsour.domain.alliance.entity.Alliance;
import com.back.nbe1214finalsour.domain.alliance.entity.AllianceMatch;
import com.back.nbe1214finalsour.domain.alliance.repository.AllianceMatchRepository;
import com.back.nbe1214finalsour.domain.alliance.repository.AllianceRepository;
import com.back.nbe1214finalsour.domain.click.dto.ClickApplyResponse;
import com.back.nbe1214finalsour.domain.click.dto.ClickRequest;
import com.back.nbe1214finalsour.domain.click.dto.ClickResponse;
import com.back.nbe1214finalsour.domain.university.service.library.LibraryBonusChecker;
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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ClickService {

    private final StringRedisTemplate stringRedisTemplate;
    private final UserRepository userRepository;
    private final RedisHandler redisHandler;
    private final ClickActionGuard clickActionGuard;
    private final LibraryBonusChecker libraryBonusChecker;
    private final AllianceMatchRepository allianceMatchRepository;
    private final AllianceRepository allianceRepository;

    private static final RedisScript<List> APPLY_CLICK = RedisScript.of(new ClassPathResource("redis/apply-click.lua"), List.class);
    private static final BigDecimal LIBRARY_MULTIPLIER = new BigDecimal("1.2");

    /**
     * @param universityId 토큰의 학교 ID
     * @param departmentId 토큰의 학과 ID. {@code null}이면(학과 claim을 넣기 전에 발급된 토큰) DB 값을 쓴다
     */
    public ClickResponse click(Long userId, Long universityId, Long departmentId, ClickRequest request) {
        int clickCount = request.clickCount();
        String submissionId = request.submissionId();
        Double lat = request.latitude();
        Double lng = request.longitude();

        long score = clickActionGuard.verifyAndGetBaseScore(userId, submissionId, clickCount);

        if (departmentId == null) {
            departmentId = userRepository.findById(userId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND))
                    .getDepartmentId();
        }

        // 아이템 적용 가져오기
        BigDecimal itemMultiplier = BigDecimal.valueOf(redisHandler.getHash(RedisKey.USER_EFFECT.of(userId), "multiplier", Double.class)
                .orElse(1.0));

        // 도서관 이스터에그
        boolean isInLibrary = libraryBonusChecker.isInLibrary(universityId, lat, lng);
        BigDecimal multiplierBigDecimal = itemMultiplier.multiply(isInLibrary ? LIBRARY_MULTIPLIER : BigDecimal.ONE);

        // 점수 계산
        score = multiplierBigDecimal.multiply(BigDecimal.valueOf(score))
                .setScale(0, RoundingMode.FLOOR).longValueExact();


        // 연합 조회, 없으면 DB 조회
        String stringAllianceId = stringRedisTemplate.opsForValue().get(RedisKey.UNIV_ALLIANCE.of(universityId));
        Long allianceId = 0L;
        if (stringAllianceId == null) {
            Alliance alliance = allianceRepository.findCurrentByUniversityId(universityId, OffsetDateTime.now())
                    .orElse(null);
            if (alliance != null) {
                stringRedisTemplate.opsForValue().set(RedisKey.UNIV_ALLIANCE.of(universityId),
                        String.valueOf(alliance.getId()),
                        Duration.between(OffsetDateTime.now(), alliance.getExpiredAt()));
                allianceId = alliance.getId();
            } else {
                stringRedisTemplate.opsForValue()
                        .set(RedisKey.UNIV_ALLIANCE.of(universityId), "none", Duration.ofSeconds(10));
            }
        } else if (!stringAllianceId.equals("none")) {
            allianceId = Long.parseLong(stringAllianceId);
        }

        // 대결 조회, 없으면 DB 조회
        Long matchId = 0L;
        String team = "";
        if (allianceId != 0L) {
            String matchResult = stringRedisTemplate.opsForValue().get(RedisKey.UNIV_MATCH.of(universityId));
            if (matchResult == null) {
                AllianceMatch match = allianceMatchRepository.findByAllianceId(allianceId, OffsetDateTime.now())
                        .orElse(null);

                if (match != null) {
                    team = match.getAllianceAId().equals(allianceId) ? "A" : "B";
                    stringRedisTemplate.opsForValue()
                            .set(RedisKey.UNIV_MATCH.of(universityId), match.getId() + ":" + team, Duration.between(OffsetDateTime.now(), match.getEndedAt()));
                    matchId = match.getId();
                } else {
                    stringRedisTemplate.opsForValue()
                            .set(RedisKey.UNIV_MATCH.of(universityId), "none", Duration.ofSeconds(10));
                }
            } else if (!matchResult.equals("none")) {
                String[] split = matchResult.split(":");
                matchId = Long.parseLong(split[0]);
                team = split[1];
            }
        }

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
                RedisKey.CLICKS_UNIV_SECOND.of(universityId, nowSec - 1),
                RedisKey.ALLIANCE_SCORE.of(allianceId),
                RedisKey.MATCH_SCORE.of(matchId)
        );

        List<String> r = stringRedisTemplate.execute(
                APPLY_CLICK,
                keys,
                String.valueOf(universityId),
                String.valueOf(departmentId),
                String.valueOf(userId),
                String.valueOf(score),
                String.valueOf(clickCount),
                String.valueOf(allianceId),
                team
        );
        ClickApplyResponse clickApplyResponse = new ClickApplyResponse(
                Long.valueOf(r.get(0)),
                Long.valueOf(r.get(1)),
                Long.valueOf(r.get(2)),
                Long.valueOf(r.get(3)),
                Long.valueOf(r.get(4)));

        return ClickResponse.from(clickApplyResponse, clickCount, score, multiplierBigDecimal.doubleValue(), universityId, departmentId, isInLibrary);
    }
}
