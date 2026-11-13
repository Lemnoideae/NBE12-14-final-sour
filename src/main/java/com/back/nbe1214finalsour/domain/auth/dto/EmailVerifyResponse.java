package com.back.nbe1214finalsour.domain.auth.dto;

/**
 * {@code POST /api/v1/auth/email/verify} 응답
 *
 * @param signupToken      회원가입 요청에 넣는 토큰 (UUID)
 * @param university       이메일 도메인으로 정한 학교
 * @param expiresInSeconds 가입 토큰 유효 시간(초)
 */
public record EmailVerifyResponse(String signupToken, UniversitySummary university, long expiresInSeconds) {
}
