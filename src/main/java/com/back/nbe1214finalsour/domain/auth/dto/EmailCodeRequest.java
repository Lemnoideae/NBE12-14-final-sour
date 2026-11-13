package com.back.nbe1214finalsour.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /api/v1/auth/email/code} 요청 */
public record EmailCodeRequest(
        @NotBlank @Email @Size(max = 254) String email) {
}
