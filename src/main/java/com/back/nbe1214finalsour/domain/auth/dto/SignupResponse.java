package com.back.nbe1214finalsour.domain.auth.dto;

/** {@code POST /api/v1/auth/signup} 응답 (201). 클라이언트는 이어서 로그인 API를 호출한다 */
public record SignupResponse(Long userId, String nickname, UniversitySummary university, DepartmentSummary department) {
}
