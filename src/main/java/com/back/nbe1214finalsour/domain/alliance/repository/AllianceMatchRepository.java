package com.back.nbe1214finalsour.domain.alliance.repository;

import com.back.nbe1214finalsour.domain.alliance.entity.AllianceMatch;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface AllianceMatchRepository extends JpaRepository<AllianceMatch, Long> {

    @Query("""
        SELECT CASE WHEN COUNT(m) > 0 THEN true ELSE false END
        FROM AllianceMatch m
        WHERE m.status = com.back.nbe1214finalsour.domain.alliance.entity.AllianceMatchStatus.REQUESTED
          AND m.deletedAt IS NULL
          AND ((m.allianceAId = :a AND m.allianceBId = :b)
            OR (m.allianceAId = :b AND m.allianceBId = :a))
        """)
    boolean existsRequestedBetween(@Param("a") Long allianceAId,
                                   @Param("b") Long allianceBId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM AllianceMatch m WHERE m.id = :matchId")
    Optional<AllianceMatch> findByIdForUpdate(@Param("matchId") Long matchId);

    // 주기적으로 만료되는 신청은 작은 묶음으로 처리해 긴 트랜잭션을 방지함.
    @Query(value = """
        SELECT id FROM alliance_match
        WHERE status = 'REQUESTED' AND deleted_at IS NULL
          AND request_expired_at <= :now
        ORDER BY id ASC LIMIT 100
        """, nativeQuery = true)
    List<Long> findExpiredRequestIds(@Param("now") OffsetDateTime now);
}
