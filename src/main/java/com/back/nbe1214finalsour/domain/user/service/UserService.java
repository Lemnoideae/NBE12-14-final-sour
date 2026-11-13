package com.back.nbe1214finalsour.domain.user.service;

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
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.domain.user.repository.UserScoreCache;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import java.util.List;
import lombok.RequiredArgsConstructor;
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
        User user = userRepository.findById(userId)
                .filter(found -> found.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.COMMON_UNAUTHORIZED, "없거나 탈퇴한 회원: " + userId));
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
