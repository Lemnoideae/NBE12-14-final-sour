package com.back.nbe1214finalsour.domain.alliance.service;

import com.back.nbe1214finalsour.domain.alliance.entity.Alliance;
import com.back.nbe1214finalsour.domain.alliance.entity.AllianceUniversity;
import com.back.nbe1214finalsour.domain.alliance.entity.AllianceUniversityStatus;
import com.back.nbe1214finalsour.domain.alliance.repository.AllianceRepository;
import com.back.nbe1214finalsour.domain.alliance.repository.AllianceUniversityRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AllianceQueryService {

    private final AllianceRepository allianceRepository;
    private final AllianceUniversityRepository allianceUniversityRepository;

    @Transactional(readOnly = true)
    public Alliance getAlliance(Long allianceId) {
        return allianceRepository.findById(allianceId)
                .filter(alliance -> alliance.getDeletedAt() == null)
                .orElseThrow(() ->
                        new BusinessException(ErrorCode.ALLY_NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public List<AllianceUniversity> getAcceptedUniversities(Long allianceId) {

        // 연합이 존재하고 삭제되지 않았는지 확인
        getAlliance(allianceId);

        // 가입 승인된 학교만 조회
        return allianceUniversityRepository
                .findByAllianceIdAndStatusAndDeletedAtIsNullOrderByIdAsc(
                        allianceId,
                        AllianceUniversityStatus.ACCEPTED
                );
    }
}