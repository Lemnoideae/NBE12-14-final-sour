package com.back.nbe1214finalsour.domain.auth.dto;

import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.global.security.Role;

/**
 * 로그인 응답. refresh 토큰은 본문이 아니라 {@code refreshToken} 쿠키로 보낸다.
 *
 * @param expiresInSeconds access 토큰 유효 시간(초). 프론트는 이 값으로 만료 전에 재발급한다
 */
public record LoginResponse(String accessToken, long expiresInSeconds, LoginUser user) {

    public record LoginUser(Long id, String nickname, Long universityId, Role role) {

        public static LoginUser from(User user) {
            return new LoginUser(user.getId(), user.getNickname(), user.getUniversityId(), user.getRole());
        }
    }
}
