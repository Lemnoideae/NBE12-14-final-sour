package com.back.nbe1214finalsour.domain.alliance.service;

import com.back.nbe1214finalsour.domain.alliance.entity.*;
import com.back.nbe1214finalsour.domain.alliance.repository.*;
import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.domain.user.entity.UserStatus;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AllianceMatchService {
    private static final int REQUIRED_MEMBER_COUNT = 2;

    private final AllianceRepository allianceRepository;
    private final AllianceUniversityRepository allianceUniversityRepository;
    private final AllianceMatchRepository allianceMatchRepository;
    private final UserRepository userRepository;

    @Transactional
    public AllianceMatch requestMatch(Long userId, Long allianceAId,
                                      Long allianceBId, int durationHours) {
        if (allianceAId == null || allianceBId == null || allianceAId <= 0 || allianceBId <= 0
                || allianceAId.equals(allianceBId) || durationHours < 1 || durationHours > 24) {
            throw invalid();
        }
        User user = activeUser(userId);
        Alliance[] pair = lockAlliances(allianceAId, allianceBId);
        Alliance a = pair[0];
        Alliance b = pair[1];
        OffsetDateTime now = OffsetDateTime.now();
        validateActiveAlliance(a, now);
        validateActiveAlliance(b, now);
        List<AllianceUniversity> membersA = members(allianceAId);
        List<AllianceUniversity> membersB = members(allianceBId);
        validateMemberCount(membersA, membersB);
        validateMembership(user, membersA);
        if (allianceMatchRepository.existsRequestedBetween(allianceAId, allianceBId)) {
            throw new BusinessException(ErrorCode.MATCH_ALREADY_REQUESTED);
        }
        OffsetDateTime earliestExpiry = earlier(a.getExpiredAt(), b.getExpiredAt());
        OffsetDateTime latestStart = earliestExpiry.minusHours(durationHours);
        if (!latestStart.isAfter(now)) {
            throw new BusinessException(ErrorCode.MATCH_INSUFFICIENT_TIME);
        }
        OffsetDateTime deadline = earlier(now.plusHours(24), latestStart);
        return allianceMatchRepository.save(AllianceMatch.request(
                allianceAId, allianceBId, durationHours, deadline));
    }

    @Transactional
    public AllianceMatch acceptMatch(Long userId, Long matchId) {
        requireMatchId(matchId);
        User user = activeUser(userId);
        // 연합 ID만 프로젝션으로 읽는다: 대결 엔티티 자체를 미리 로딩하지 않는다.
        AllianceMatchPair pairIds = findPair(matchId);
        Alliance[] pair = lockAlliances(pairIds.allianceAId(), pairIds.allianceBId());
        // 락을 모두 획득한 뒤, 최신 커밋 상태의 대결을 최초 로딩한다.
        AllianceMatch match = lockMatch(matchId);
        ensureSamePair(pairIds, match);
        OffsetDateTime now = OffsetDateTime.now();

        // 이 검증을 연합 활성 상태 검사보다 먼저 수행해야 중복 수락에 일관된 오류가 반환된다.
        validateRequested(match, now);
        validateActiveAlliance(pair[0], now);
        validateActiveAlliance(pair[1], now);
        List<AllianceUniversity> membersA = members(match.getAllianceAId());
        List<AllianceUniversity> membersB = members(match.getAllianceBId());
        validateMemberCount(membersA, membersB);
        validateMembership(user, membersB); // 수락은 반드시 B 연합 회원만
        if (now.plusHours(match.getDurationHours()).isAfter(
                earlier(pair[0].getExpiredAt(), pair[1].getExpiredAt()))) {
            throw new BusinessException(ErrorCode.MATCH_INSUFFICIENT_TIME);
        }
        match.accept(now);
        pair[0].startMatch(now);
        pair[1].startMatch(now);
        return match;
    }

    // A는 '취소', B는 '거절'. 모두 요청 대기 중일 때만 가능하다.
    @Transactional
    public AllianceMatch cancelMatch(Long userId, Long matchId) {
        requireMatchId(matchId);
        User user = activeUser(userId);
        AllianceMatchPair pairIds = findPair(matchId);
        lockAlliances(pairIds.allianceAId(), pairIds.allianceBId());
        AllianceMatch match = lockMatch(matchId);
        ensureSamePair(pairIds, match);
        if (match.getStatus() != AllianceMatchStatus.REQUESTED || match.getDeletedAt() != null) {
            throw new BusinessException(ErrorCode.MATCH_NOT_PENDING);
        }
        // 같은 학교의 다른 회원도 행동할 수 있다는 연합 정책에 따라 A/B 회원 모두 허용.
        boolean permitted = belongsTo(user, members(match.getAllianceAId()))
                || belongsTo(user, members(match.getAllianceBId()));
        if (!permitted) throw new BusinessException(ErrorCode.ALLY_NOT_MEMBER);
        match.cancelRequested();
        return match;
    }

    // 스케줄러에서 호출. 반드시 '연합 ID 오름차순 -> 대결 ID' 순서로 잠근다.
    @Transactional
    public void cancelExpiredRequest(Long matchId) {
        if (matchId == null || matchId <= 0) return;
        // 스케줄러에서도 연합 ID만 읽고 엔티티는 먼저 로딩하지 않는다.
        AllianceMatchPair pairIds = allianceMatchRepository.findPairById(matchId).orElse(null);
        if (pairIds == null) return;
        lockAlliances(pairIds.allianceAId(), pairIds.allianceBId());
        AllianceMatch match = allianceMatchRepository.findByIdForUpdate(matchId).orElse(null);
        if (match == null) return;
        ensureSamePair(pairIds, match);
        if (match.getStatus() == AllianceMatchStatus.REQUESTED && match.getDeletedAt() == null
                && match.getRequestExpiredAt() != null
                && !match.getRequestExpiredAt().isAfter(OffsetDateTime.now())) {
            match.cancelRequested();
        }
    }

    // 연합 자체 만료 시 요청 대기 건을 닫는다. 일반적인 요청 만료 시간과는 별개.
    @Transactional
    public void cancelRequestedForAllianceExpiry(Long matchId, Long expiringAllianceId) {
        AllianceMatchPair ids = allianceMatchRepository.findPairById(matchId).orElse(null);
        if (ids == null || (!ids.allianceAId().equals(expiringAllianceId)
                && !ids.allianceBId().equals(expiringAllianceId))) return;
        Alliance[] pair = lockAlliances(ids.allianceAId(), ids.allianceBId());
        Alliance expiring = ids.allianceAId().equals(expiringAllianceId) ? pair[0] : pair[1];
        if (expiring.getExpiredAt() == null || expiring.getExpiredAt().isAfter(OffsetDateTime.now())) return;
        AllianceMatch match = allianceMatchRepository.findByIdForUpdate(matchId).orElse(null);
        if (match != null && match.getDeletedAt() == null
                && match.getStatus() == AllianceMatchStatus.REQUESTED) match.cancelRequested();
    }

    @Transactional(readOnly = true)
    public AllianceMatch getMatch(Long matchId) {
        requireMatchId(matchId);
        return findMatch(matchId);
    }

    private User activeUser(Long id) {
        if (id == null || id <= 0) throw invalid();
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        if (user.getStatus() != UserStatus.ACTIVE || user.getDeletedAt() != null) {
            throw new BusinessException(ErrorCode.ALLY_USER_NOT_ACTIVE);
        }
        return user;
    }

    private AllianceMatch findMatch(Long id) {
        return allianceMatchRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MATCH_NOT_FOUND));
    }

    private AllianceMatchPair findPair(Long id) {
        return allianceMatchRepository.findPairById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MATCH_NOT_FOUND));
    }

    private AllianceMatch lockMatch(Long id) {
        return allianceMatchRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MATCH_NOT_FOUND));
    }

    // 순서 통일로 A->B 및 B->A 요청 간 교착 가능성을 낮춘다.
    private Alliance[] lockAlliances(Long aId, Long bId) {
        Long firstId = Math.min(aId, bId);
        Long secondId = Math.max(aId, bId);
        Alliance first = allianceRepository.findByIdForUpdate(firstId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ALLY_NOT_FOUND));
        Alliance second = allianceRepository.findByIdForUpdate(secondId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ALLY_NOT_FOUND));
        return aId.equals(firstId) ? new Alliance[]{first, second} : new Alliance[]{second, first};
    }

    private List<AllianceUniversity> members(Long id) {
        return allianceUniversityRepository.findByAllianceIdAndStatusAndDeletedAtIsNullOrderByIdAsc(
                id, AllianceUniversityStatus.ACCEPTED);
    }

    private static void validateRequested(AllianceMatch match, OffsetDateTime now) {
        if (match.getDeletedAt() != null || match.getStatus() != AllianceMatchStatus.REQUESTED) {
            throw new BusinessException(ErrorCode.MATCH_NOT_PENDING);
        }
        if (match.getRequestExpiredAt() == null || !now.isBefore(match.getRequestExpiredAt())) {
            throw new BusinessException(ErrorCode.MATCH_REQUEST_EXPIRED);
        }
    }

    private static void validateActiveAlliance(Alliance a, OffsetDateTime now) {
        if (a.getStatus() != AllianceStatus.ACTIVE || a.getDeletedAt() != null
                || a.getExpiredAt() == null || !a.getExpiredAt().isAfter(now)) {
            throw new BusinessException(ErrorCode.ALLY_NOT_ACTIVE);
        }
    }

    private static void validateMemberCount(List<AllianceUniversity> a, List<AllianceUniversity> b) {
        if (a.size() != REQUIRED_MEMBER_COUNT || b.size() != REQUIRED_MEMBER_COUNT) {
            throw new BusinessException(ErrorCode.MATCH_MEMBERS_INCOMPLETE);
        }
    }

    private static boolean belongsTo(User user, List<AllianceUniversity> members) {
        return members.stream().anyMatch(m -> m.getUniversityId().equals(user.getUniversityId()));
    }

    private static void validateMembership(User user, List<AllianceUniversity> members) {
        if (!belongsTo(user, members)) throw new BusinessException(ErrorCode.ALLY_NOT_MEMBER);
    }

    private static OffsetDateTime earlier(OffsetDateTime a, OffsetDateTime b) {
        return a.isBefore(b) ? a : b;
    }

    private static void ensureSamePair(AllianceMatchPair pairIds, AllianceMatch locked) {
        if (!pairIds.allianceAId().equals(locked.getAllianceAId())
                || !pairIds.allianceBId().equals(locked.getAllianceBId())) throw invalid();
    }

    private static void requireMatchId(Long matchId) {
        if (matchId == null || matchId <= 0) throw invalid();
    }

    private static BusinessException invalid() {
        return new BusinessException(ErrorCode.COMMON_INVALID_INPUT);
    }
}
