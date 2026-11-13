package com.back.nbe1214finalsour.domain.click.dto;

public record ClickResponse(
        Long acceptedClicks,
        Long earnedScore,
        Double multiplier,
        Long myContribScore,
        ClickUniversityResponse university,
        ClickDepartmentResponse department,
        Long schoolClicksLastSecond
) {
    public static ClickResponse from(ClickApplyResponse clickApplyResponse, int clickCount, int score, Double multiplier, Long universityId, Long departmentId) {
        // TODO: 대학 로고 URL 수정
        return new ClickResponse(
                (long) clickCount,
                (long) score,
                multiplier,
                clickApplyResponse.myContrib(),
                new ClickUniversityResponse(universityId, clickApplyResponse.univTotal(), clickApplyResponse.univRank(), "tempUrl"),
                new ClickDepartmentResponse(departmentId, clickApplyResponse.deptTotal()),
                clickApplyResponse.lastSecond()
        );
    }

    record ClickUniversityResponse(Long id, Long totalScore, Long rank, String logoUrl) {}
    record ClickDepartmentResponse(Long id, Long totalScore) {}
}