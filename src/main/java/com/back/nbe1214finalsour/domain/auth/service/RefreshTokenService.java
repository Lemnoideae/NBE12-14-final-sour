package com.back.nbe1214finalsour.domain.auth.service;

import com.back.nbe1214finalsour.domain.auth.entity.RefreshToken;
import com.back.nbe1214finalsour.domain.auth.repository.RefreshTokenRepository;
import com.back.nbe1214finalsour.global.security.jwt.JwtProvider;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * refresh 토큰을 발급한다. 원문은 호출한 쪽이 쿠키로만 보내고, DB에는 원문의 SHA-256 hex만 저장한다
 * (API 명세서 재발급 "쿠키 값의 SHA-256으로 REFRESH_TOKEN을 찾아", DDL {@code ck_refresh_token_token}).
 *
 * <p>로그인할 때마다 행을 하나 만든다. 기기마다 따로 로그인할 수 있도록 이전 행은 지우지 않는다.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtProvider jwtProvider;
    private final Clock clock;

    /** 새 refresh 토큰을 저장하고 원문을 돌려준다 */
    @Transactional
    public String issue(Long userId) {
        String token = jwtProvider.generateRefreshToken();
        OffsetDateTime expiredAt = OffsetDateTime.now(clock).plus(jwtProvider.refreshTokenTtl());
        refreshTokenRepository.save(RefreshToken.issue(userId, hash(token), expiredAt));
        return token;
    }

    /** refresh 토큰 원문의 SHA-256, 소문자 hex 64자 */
    public static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256을 쓸 수 없습니다", e);
        }
    }
}
