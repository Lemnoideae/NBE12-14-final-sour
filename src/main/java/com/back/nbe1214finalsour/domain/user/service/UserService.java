package com.back.nbe1214finalsour.domain.user.service;

import com.back.nbe1214finalsour.domain.auth.service.RefreshTokenService;
import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import com.back.nbe1214finalsour.domain.clicker.service.ClickerService;
import com.back.nbe1214finalsour.domain.university.entity.Department;
import com.back.nbe1214finalsour.domain.university.entity.University;
import com.back.nbe1214finalsour.domain.university.repository.DepartmentRepository;
import com.back.nbe1214finalsour.domain.university.repository.UniversityRepository;
import com.back.nbe1214finalsour.domain.user.dto.MyInfoResponse;
import com.back.nbe1214finalsour.domain.user.dto.MyInfoResponse.ClickerInfo;
import com.back.nbe1214finalsour.domain.user.dto.MyInfoResponse.DepartmentInfo;
import com.back.nbe1214finalsour.domain.user.dto.MyInfoResponse.UniversityInfo;
import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.domain.user.entity.UserStatus;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.domain.user.repository.UserScoreCache;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final UniversityRepository universityRepository;
    private final DepartmentRepository departmentRepository;
    private final ClickerService clickerService;
    private final UserScoreCache userScoreCache;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;
    private final Clock clock;

    /** 탈퇴하지 않은 회원 중에 대소문자를 무시하고 같은 닉네임이 없으면 사용할 수 있다 */
    public boolean isNicknameAvailable(String nickname) {
        return !userRepository.existsActiveNicknameIgnoreCase(nickname);
    }

    /**
     * 로그인한 회원의 정보 (API 명세서 §3-2 "내 정보").
     *
     * <p>토큰은 유효해도 회원이 없거나 탈퇴했으면 401 {@code COMMON_UNAUTHORIZED}다. 토큰 재발급이 활동 중이 아닌 회원을
     * 401로 거절하는 것과 같은 기준이다. 정지·차단 회원은 로그인 때만 막으므로 여기서는 상태를 그대로 알려 준다 (계획 Q3).
     */
    public MyInfoResponse getMyInfo(Long userId) {
        User user = findActiveUser(userId);
        // 학교·학과·클리커는 users의 외래키가 보장하므로 없으면 데이터 오류다
        University university = universityRepository.findById(user.getUniversityId()).orElseThrow();
        Department department = departmentRepository.findById(user.getDepartmentId()).orElseThrow();

        long contribScore = userScoreCache.findContribScore(user.getUniversityId(), userId)
                .orElse(user.getTotalContribScore());
        long attackScore = userScoreCache.findAttackScore(userId).orElse(user.getTotalAttackScore());

        return new MyInfoResponse(
                user.getId(),
                user.getNickname(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.getLogoUrl(),
                new UniversityInfo(university.getId(), university.getName(), university.getLogoUrl()),
                new DepartmentInfo(department.getId(), department.getName()),
                clickerInfo(user.getClickerId()),
                contribScore,
                attackScore);
    }

    /**
     * 비밀번호 변경 (추가 명세 §3-1). 현재 비밀번호를 확인한 뒤 바꾸고, 이 회원의 refresh 토큰을 모두 지워 모든 기기를
     * 로그아웃시킨다. 새 비밀번호가 현재와 같아도 막지 않는다 (계획 Q1).
     *
     * @throws BusinessException 400 {@code USER_INVALID_PASSWORD}: 현재 비밀번호 불일치.
     *                           401 {@code COMMON_UNAUTHORIZED}: 없거나 탈퇴한 회원
     */
    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = findActiveUser(userId);
        verifyPassword(user, currentPassword);
        user.changePassword(passwordEncoder.encode(newPassword));
        refreshTokenService.revokeAll(userId);
    }

    /**
     * 회원 탈퇴 (추가 명세 §3-1). 비밀번호를 확인한 뒤 soft delete 하고 refresh 토큰을 모두 지운다.
     * 정지·차단 회원은 탈퇴할 수 없다 (탈퇴 후 재가입으로 정지를 피하는 것 방지). 확인 순서는 로그인과 같다: 비밀번호 → 상태.
     *
     * @throws BusinessException 400 {@code USER_INVALID_PASSWORD}: 비밀번호 불일치.
     *                           403 {@code USER_SUSPENDED}: 정지·차단.
     *                           401 {@code COMMON_UNAUTHORIZED}: 없거나 이미 탈퇴한 회원
     */
    @Transactional
    public void withdraw(Long userId, String password) {
        User user = findActiveUser(userId);
        verifyPassword(user, password);
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.USER_SUSPENDED,
                    "탈퇴 거부: userId=" + userId + ", status=" + user.getStatus());
        }
        user.withdraw(OffsetDateTime.now(clock));
        refreshTokenService.revokeAll(userId);
    }

    private void verifyPassword(User user, String rawPassword) {
        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            throw new BusinessException(ErrorCode.USER_INVALID_PASSWORD, "비밀번호 불일치: userId=" + user.getId());
        }
    }

    /** 토큰은 유효해도 회원이 없거나 탈퇴했으면 401 {@code COMMON_UNAUTHORIZED} (재발급과 같은 기준) */
    private User findActiveUser(Long userId) {
        return userRepository.findById(userId)
                .filter(found -> found.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.COMMON_UNAUTHORIZED, "없거나 탈퇴한 회원: " + userId));
    }

    /** 레벨표는 {@link ClickerService}가 캐시한 것을 쓴다 (클리커 업그레이드와 같은 출처) */
    private ClickerInfo clickerInfo(Long level) {
        List<Clicker> levelTable = clickerService.getLevelTable();
        Clicker current = levelTable.stream()
                .filter(clicker -> clicker.getId().equals(level))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("레벨표에 없는 클리커 레벨: " + level));
        Long nextLevelRequiredScore = levelTable.stream()
                .filter(clicker -> clicker.getId() == level + 1)
                .findFirst()
                .map(Clicker::getRequiredScore)
                .orElse(null);
        return new ClickerInfo(current.getId(), current.getClickPower(), nextLevelRequiredScore);
    }
}
