package com.back.nbe1214finalsour.domain.alliance.service;

import com.back.nbe1214finalsour.domain.alliance.entity.Alliance;
import com.back.nbe1214finalsour.domain.alliance.entity.AllianceUniversity;
import com.back.nbe1214finalsour.domain.alliance.entity.AllianceUniversityStatus;
import com.back.nbe1214finalsour.domain.alliance.repository.AllianceRepository;
import com.back.nbe1214finalsour.domain.alliance.repository.AllianceUniversityRepository;
import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.domain.user.entity.UserStatus;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class AllianceService {

    private final AllianceRepository allianceRepository;
    private final AllianceUniversityRepository allianceUniversityRepository;
    private final UserRepository userRepository;

    @Transactional
    public Alliance createAlliance(Long userId, String name, int durationHours) {

        // 1. 사용자 조회
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new BusinessException(ErrorCode.USER_NOT_FOUND));

        // 2. 활성 회원인지 확인
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.ALLY_USER_NOT_ACTIVE);
        }

        Long universityId = user.getUniversityId();

        // 3. 이미 연합에 가입한 학교인지 확인
        boolean alreadyJoined = allianceUniversityRepository
                .existsByUniversityIdAndStatusAndDeletedAtIsNull(
                        universityId,
                        AllianceUniversityStatus.ACCEPTED
                );

        if (alreadyJoined) {
            throw new BusinessException(
                    ErrorCode.ALLY_UNIVERSITY_ALREADY_JOINED
            );
        }

        // 4. 연합 생성 및 입력값 검증
        Alliance alliance;
        try {
            alliance = Alliance.create(
                    name,
                    durationHours,
                    OffsetDateTime.now()
            );
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_INPUT);
        }

        // 5. 연합 저장
        Alliance savedAlliance = allianceRepository.save(alliance);

        // 6. 최초 학교 자동 가입
        AllianceUniversity founder = AllianceUniversity.createFounder(
                savedAlliance.getId(),
                universityId,
                userId
        );

        allianceUniversityRepository.save(founder);

        // 7. 연합 반환
        return savedAlliance;
    }
}