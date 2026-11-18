package com.back.nbe1214finalsour.domain.alliance.repository;

import com.back.nbe1214finalsour.domain.alliance.entity.Alliance;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.List;
import java.time.OffsetDateTime;

public interface AllianceRepository extends JpaRepository<Alliance, Long> {

    @Query(value = """
        SELECT id FROM alliance WHERE status <> 'EXPIRED'
          AND deleted_at IS NULL AND expired_at <= :now
        ORDER BY id LIMIT 100
        """, nativeQuery = true)
    List<Long> findDueExpirationIds(@Param("now") OffsetDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Alliance a WHERE a.id = :allianceId")
    Optional<Alliance> findByIdForUpdate(
            @Param("allianceId") Long allianceId
    );
}