package com.back.nbe1214finalsour.domain.auth.controller;

import com.back.nbe1214finalsour.domain.auth.dto.EmailCodeRequest;
import com.back.nbe1214finalsour.domain.auth.dto.EmailCodeResponse;
import com.back.nbe1214finalsour.domain.auth.dto.EmailVerifyRequest;
import com.back.nbe1214finalsour.domain.auth.dto.EmailVerifyResponse;
import com.back.nbe1214finalsour.domain.auth.dto.LoginRequest;
import com.back.nbe1214finalsour.domain.auth.dto.LoginResponse;
import com.back.nbe1214finalsour.domain.auth.dto.SignupRequest;
import com.back.nbe1214finalsour.domain.auth.dto.SignupResponse;
import com.back.nbe1214finalsour.domain.auth.service.EmailVerificationService;
import com.back.nbe1214finalsour.domain.auth.service.LoginService;
import com.back.nbe1214finalsour.domain.auth.service.LoginService.LoginResult;
import com.back.nbe1214finalsour.domain.auth.service.SignupService;
import com.back.nbe1214finalsour.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 인증 API. 모두 인증이 필요 없다 (API 명세서 §2) */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final EmailVerificationService emailVerificationService;
    private final SignupService signupService;
    private final LoginService loginService;

    @PostMapping("/email/code")
    public ApiResponse<EmailCodeResponse> requestEmailCode(@Valid @RequestBody EmailCodeRequest request) {
        return ApiResponse.ok(emailVerificationService.requestCode(request.email()));
    }

    @PostMapping("/email/verify")
    public ApiResponse<EmailVerifyResponse> verifyEmailCode(@Valid @RequestBody EmailVerifyRequest request) {
        return ApiResponse.ok(emailVerificationService.verifyCode(request.email(), request.code()));
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ApiResponse.ok(signupService.signup(request));
    }

    /** access 토큰은 본문으로, refresh 토큰은 {@code refreshToken} 쿠키로 보낸다 */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        LoginResult result = loginService.login(request.email(), request.password());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        RefreshTokenCookies.issue(result.refreshToken(), result.refreshTokenTtl()).toString())
                .body(ApiResponse.ok(result.response()));
    }
}
