package com.back.nbe1214finalsour.domain.auth.dto;

/**
 * 재발급 응답. 새 refresh 토큰은 {@code refreshToken} 쿠키로 보낸다.
 *
 * @param expiresInSeconds access 토큰 유효 시간(초)
 */
public record ReissueResponse(String accessToken, long expiresInSeconds) {
}
