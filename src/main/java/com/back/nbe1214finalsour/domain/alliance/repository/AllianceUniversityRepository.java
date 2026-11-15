package com.back.nbe1214finalsour.domain.alliance.repository;

import com.back.nbe1214finalsour.domain.alliance.entity.AllianceUniversity;
import com.back.nbe1214finalsour.domain.alliance.entity.AllianceUniversityStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

import java.util.List;

public interface AllianceUniversityRepository
        extends JpaRepository<AllianceUniversity, Long> {

    boolean existsByUniversityIdAndStatusAndDeletedAtIsNull(
            Long universityId,
            AllianceUniversityStatus status
    );

    List<AllianceUniversity> findByAllianceIdAndStatusAndDeletedAtIsNullOrderByIdAsc(
            Long allianceId,
            AllianceUniversityStatus status
    );

    long countByAllianceIdAndStatusAndDeletedAtIsNull(
            Long allianceId,
            AllianceUniversityStatus status
    );

    @Query("""
        SELECT au.allianceId
        FROM AllianceUniversity au
        WHERE au.id = :applicationId
          AND au.deletedAt IS NULL
        """)
    Optional<Long> findAllianceIdByApplicationId(
            @Param("applicationId") Long applicationId
    );
}