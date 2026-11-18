package com.back.nbe1214finalsour.domain.click.dto;

public record AttackResponse(
        Long acceptedClicks,
        Long damage,
        Double multiplier,
        Boolean isRival,
        AttackUniversityResponse targetUniversity,
        Long myAttackScore
) {
    public static AttackResponse from(AttackApplyResponse attackApplyResponse, int clickCount,
                                      boolean isRival, Long targetUniversityId, String targetName) {
        return new AttackResponse(
                (long) clickCount,
                attackApplyResponse.damage(),
                isRival ? 1.1 : 1.0,
                isRival,
                new AttackUniversityResponse(targetUniversityId, targetName, attackApplyResponse.univTotal(), attackApplyResponse.univRank()),
                attackApplyResponse.myAttackScore()
        );
    }
    record AttackUniversityResponse(Long id, String name, Long totalScore, Long rank) {}
}
