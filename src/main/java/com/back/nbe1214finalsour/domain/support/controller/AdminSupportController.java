package com.back.nbe1214finalsour.domain.support.controller;

import com.back.nbe1214finalsour.domain.support.dto.AdminSupportDetailResponse;
import com.back.nbe1214finalsour.domain.support.dto.AdminSupportListResponse;
import com.back.nbe1214finalsour.domain.support.dto.SupportAnswerRequest;
import com.back.nbe1214finalsour.domain.support.dto.SupportAnswerResponse;
import com.back.nbe1214finalsour.domain.support.entity.SupportStatus;
import com.back.nbe1214finalsour.domain.support.service.AdminSupportService;
import com.back.nbe1214finalsour.global.response.ApiResponse;
import com.back.nbe1214finalsour.global.security.AuthUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 문의 목록·상세·답변 (추가 명세 §3-9, 상세는 SCRUM-173).
 *
 * <p>권한은 {@code SecurityConfig}가 {@code /api/v1/admin/**} 경로로 한 번에 막는다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/supports")
public class AdminSupportController {

    private final AdminSupportService adminSupportService;

    /** 문의 목록. {@code status}를 생략하면 전체, {@code RECEIVED}·{@code ANSWERED}가 아니면 400 */
    @GetMapping
    public ApiResponse<AdminSupportListResponse> getList(
            @RequestParam(required = false) @Nullable SupportStatus status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return ApiResponse.ok(adminSupportService.getList(status, page, size));
    }

    /** 문의 상세. 본문·첨부·답변과 수신 이메일을 준다. 없으면 404 {@code SUPPORT_NOT_FOUND} */
    @GetMapping("/{supportId}")
    public ApiResponse<AdminSupportDetailResponse> getDetail(@PathVariable Long supportId) {
        return ApiResponse.ok(adminSupportService.getDetail(supportId));
    }

    /** 문의 답변. 답변 메일은 커밋 뒤 비동기로 보낸다 */
    @PostMapping("/{supportId}/answer")
    public ApiResponse<SupportAnswerResponse> answer(
            @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long supportId,
            @Valid @RequestBody SupportAnswerRequest request) {
        return ApiResponse.ok(adminSupportService.answer(authUser.userId(), supportId, request));
    }
}
