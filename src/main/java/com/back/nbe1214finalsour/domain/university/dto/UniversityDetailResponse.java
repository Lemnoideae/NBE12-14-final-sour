package com.back.nbe1214finalsour.domain.university.dto;

import java.util.List;

public record UniversityDetailResponse(
        Long id,
        String name,
        String logoUrl,
        Long totalScore,
        Long rank,
        Long memberCount,
        List<TopDepartment> topDepartments,
        List<TopContributor> topContributors,
        boolean isMyUniversity
) {
    // 해당 학교에서 점수가 높은 학과 정보
    public record TopDepartment(
            Long rank,
            Long id,
            String name,
            Long totalScore
    ) {
    }

    // 해당 학교에서 기여도가 높은 사용자 정보
    public record TopContributor(
            Long rank,
            Long userId,
            String nickname,
            Long contribScore
    ) {
    }
}
