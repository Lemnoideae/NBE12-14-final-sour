package com.back.nbe1214finalsour.domain.user.dto;

import com.back.nbe1214finalsour.domain.user.entity.UserStatus;
import com.back.nbe1214finalsour.global.security.Role;

/**
 * {@code GET /api/v1/users/me} 응답 (API 명세서 §3-2 "내 정보").
 *
 * @param email            복호화한 학교 이메일
 * @param profileImageUrl  프로필 이미지 ({@code users.logo_url}). 없으면 {@code null}
 * @param totalContribScore 기여도. Redis 실시간 값, 없으면 DB 값
 * @param totalAttackScore 공격 점수. Redis 실시간 값, 없으면 DB 값
 */
public record MyInfoResponse(
        Long id,
        String nickname,
        String email,
        Role role,
        UserStatus status,
        String profileImageUrl,
        UniversityInfo university,
        DepartmentInfo department,
        ClickerInfo clicker,
        long totalContribScore,
        long totalAttackScore) {

    /** @param logoUrl 학교 로고 ({@code university.logo_url}). 없으면 {@code null} */
    public record UniversityInfo(Long id, String name, String logoUrl) {
    }

    public record DepartmentInfo(Long id, String name) {
    }

    /**
     * @param level                  현재 레벨 ({@code clicker.id})
     * @param nextLevelRequiredScore 다음 레벨로 올릴 때 차감하는 기여도. 최고 레벨이면 {@code null}
     */
    public record ClickerInfo(Long level, int clickPower, Long nextLevelRequiredScore) {
    }
}
