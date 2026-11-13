package com.back.nbe1214finalsour.global.crypto;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 이메일로 회원을 찾기 위한 해시를 만든다 ({@code users.email_hash}).
 *
 * <p>정규화한 이메일의 HMAC-SHA256을 소문자 hex 64자로 만든다 (DB 제약 {@code ck_users_email_hash}).
 * 평문 SHA-256이 아닌 HMAC을 쓰는 이유: 학교 이메일은 {@code 학번@도메인}처럼 추측하기 쉬워,
 * DB가 유출되면 평문 해시는 대입만으로 가입 여부가 드러난다 (회원 MVP 계획 Q5).
 */
@Component
@EnableConfigurationProperties(EmailCryptoProperties.class)
public class EmailHasher {

    private static final String ALGORITHM = "HmacSHA256";
    private static final int MIN_KEY_BYTES = 32;

    private final SecretKeySpec key;

    public EmailHasher(EmailCryptoProperties properties) {
        byte[] keyBytes = Base64.getDecoder().decode(properties.hashKey());
        if (keyBytes.length < MIN_KEY_BYTES) {
            throw new IllegalArgumentException(
                    "email-crypto.hash-key는 Base64로 인코딩한 32바이트 이상이어야 합니다 (현재 " + keyBytes.length + "바이트)");
        }
        this.key = new SecretKeySpec(keyBytes, ALGORITHM);
    }

    /** 앞뒤 공백을 지우고 전체를 소문자로 바꾼다. 로그인·중복 판단이 같은 기준을 쓰도록 이메일은 항상 이 값으로 다룬다. */
    public static String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    /** {@link #normalize(String)}한 뒤 해시한다. */
    public String hash(String email) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            byte[] digest = mac.doFinal(normalize(email).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("이메일 해시를 만들지 못했습니다", e);
        }
    }
}
