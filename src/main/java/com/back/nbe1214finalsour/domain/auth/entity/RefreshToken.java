package com.back.nbe1214finalsour.domain.auth.entity;

import com.back.nbe1214finalsour.global.jpa.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * refresh 토큰 ({@code refresh_token}). 원문은 쿠키로만 보내고 DB에는 SHA-256 해시를 저장한다.
 * 재발급할 때마다 행을 지우고 새로 만든다 (Rotation).
 */
@Entity
@Table(name = "refresh_token")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 원문의 SHA-256, 소문자 hex 64자 ({@code ck_refresh_token_token}) */
    @Column(nullable = false, length = 64)
    private String token;

    @Column(name = "expired_at", nullable = false)
    private OffsetDateTime expiredAt;

    /**
     * @param tokenHash 원문의 SHA-256 소문자 hex (원문을 넣지 않는다)
     */
    public static RefreshToken issue(Long userId, String tokenHash, OffsetDateTime expiredAt) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.userId = userId;
        refreshToken.token = tokenHash;
        refreshToken.expiredAt = expiredAt;
        return refreshToken;
    }
}
