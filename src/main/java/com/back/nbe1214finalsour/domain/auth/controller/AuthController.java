package com.back.nbe1214finalsour.domain.auth.controller;

import com.back.nbe1214finalsour.domain.auth.dto.EmailCodeRequest;
import com.back.nbe1214finalsour.domain.auth.dto.EmailCodeResponse;
import com.back.nbe1214finalsour.domain.auth.dto.EmailVerifyRequest;
import com.back.nbe1214finalsour.domain.auth.dto.EmailVerifyResponse;
import com.back.nbe1214finalsour.domain.auth.service.EmailVerificationService;
import com.back.nbe1214finalsour.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 인증 API. 모두 인증이 필요 없다 (API 명세서 §2) */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final EmailVerificationService emailVerificationService;

    @PostMapping("/email/code")
    public ApiResponse<EmailCodeResponse> requestEmailCode(@Valid @RequestBody EmailCodeRequest request) {
        return ApiResponse.ok(emailVerificationService.requestCode(request.email()));
    }

    @PostMapping("/email/verify")
    public ApiResponse<EmailVerifyResponse> verifyEmailCode(@Valid @RequestBody EmailVerifyRequest request) {
        return ApiResponse.ok(emailVerificationService.verifyCode(request.email(), request.code()));
    }
}
