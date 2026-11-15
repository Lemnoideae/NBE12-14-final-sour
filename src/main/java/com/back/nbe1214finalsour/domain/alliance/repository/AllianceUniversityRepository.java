package com.back.nbe1214finalsour.domain.alliance.repository;

import com.back.nbe1214finalsour.domain.alliance.entity.AllianceUniversity;
import com.back.nbe1214finalsour.domain.alliance.entity.AllianceUniversityStatus;
import org.springframework.data.jpa.repository.JpaRepository;

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
}