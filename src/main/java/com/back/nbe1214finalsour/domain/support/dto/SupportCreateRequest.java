package com.back.nbe1214finalsour.domain.support.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/**
 * {@code POST /api/v1/supports} 요청 (추가 명세 §3-8).
 *
 * <p>{@code recipientEmail}은 검증 전에 앞뒤 공백만 지운다 (계획 D3). 본문 길이 상한 5,000자는 명세에 없고 계획 D2에서 정했다.
 *
 * @param attachFileUrl 회원만 보낼 수 있다. 빈 문자열은 첨부 없음으로 본다
 */
public record SupportCreateRequest(
        @NotBlank @Email @Size(max = 254) String recipientEmail,
        @NotBlank @Size(max = 100) String title,
        @NotBlank @Size(max = 5000) String content,
        @Nullable String attachFileUrl) {

    public SupportCreateRequest {
        recipientEmail = recipientEmail == null ? null : recipientEmail.strip();
        attachFileUrl = attachFileUrl == null || attachFileUrl.isBlank() ? null : attachFileUrl;
    }
}
