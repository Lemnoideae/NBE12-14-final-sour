package com.back.nbe1214finalsour.domain.auth.dto;

/**
 * {@code POST /api/v1/auth/email/code} 응답
 *
 * @param university       이메일 도메인으로 정한 학교
 * @param expiresInSeconds 코드 유효 시간(초)
 */
public record EmailCodeResponse(UniversitySummary university, long expiresInSeconds) {
}
