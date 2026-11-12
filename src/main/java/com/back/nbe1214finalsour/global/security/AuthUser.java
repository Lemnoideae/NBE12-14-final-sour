package com.back.nbe1214finalsour.global.security;

/**
 * 로그인한 회원. JWT claim에서 만들어지므로 요청마다 DB를 조회하지 않는다.
 *
 * <p>컨트롤러에서 {@code @AuthenticationPrincipal AuthUser authUser}로 받는다.
 * 로그인하지 않은 요청이면 {@code null}이다 (인증 "선택" API).
 *
 * @param userId       회원 ID
 * @param universityId 소속 학교 ID. 클릭 등 학교가 정해지는 API는 요청 값이 아니라 이 값을 쓴다 (API 명세서 §3-3)
 * @param role         권한
 */
public record AuthUser(Long userId, Long universityId, Role role) {
}
