package com.back.nbe1214finalsour.domain.support.controller;

import com.back.nbe1214finalsour.domain.support.dto.SupportCreateRequest;
import com.back.nbe1214finalsour.domain.support.dto.SupportCreateResponse;
import com.back.nbe1214finalsour.domain.support.service.SupportService;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.response.ApiResponse;
import com.back.nbe1214finalsour.global.security.AuthUser;
import com.back.nbe1214finalsour.global.security.jwt.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 고객 문의 API (추가 명세 §3-8) */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/supports")
public class SupportController {

    private final SupportService supportService;

    /**
     * 문의 등록. 인증 선택이지만 다른 "선택" API와 달리, 토큰을 보냈는데 틀렸으면 익명으로 넘기지 않고 401로 막는다 (계획 Q4).
     * 만료된 토큰을 가진 회원의 문의가 비회원 문의로 저장되어 "내 문의"에서 사라지지 않게 하고, 프론트가 재발급 후 다시 보내게
     * 한다. 비회원 한도는 {@code getRemoteAddr()}로 센다 (프록시 뒤 실제 IP는 {@code server.forward-headers-strategy}).
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SupportCreateResponse> create(
            @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody SupportCreateRequest request,
            HttpServletRequest servletRequest) {
        rejectInvalidToken(servletRequest);
        Long userId = authUser == null ? null : authUser.userId();
        return ApiResponse.ok(supportService.create(userId, servletRequest.getRemoteAddr(), request));
    }

    /** JWT 필터가 남긴 토큰 오류(만료·위조·끊긴 세션)가 있으면 그 코드로 401 */
    private static void rejectInvalidToken(HttpServletRequest request) {
        if (request.getAttribute(JwtAuthenticationFilter.TOKEN_ERROR_ATTRIBUTE) instanceof ErrorCode tokenError) {
            throw new BusinessException(tokenError, "문의 등록에 유효하지 않은 토큰");
        }
    }
}
