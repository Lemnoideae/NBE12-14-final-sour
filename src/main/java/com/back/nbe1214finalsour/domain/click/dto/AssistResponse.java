package com.back.nbe1214finalsour.domain.click.dto;

/**
 * 연합 학교 지원 응답 (추가 명세 §3-3).
 * assistScore는 대상 학교에 더한 점수, myContribScore는 지원 뒤 내 누적 기여도다.
 */
public record AssistResponse(
        Long acceptedClicks,
        Long assistScore,
        AssistUniversityResponse targetUniversity,
        Long myContribScore
) {
    public record AssistUniversityResponse(Long id, String name, Long totalScore, Long rank) {}
}
