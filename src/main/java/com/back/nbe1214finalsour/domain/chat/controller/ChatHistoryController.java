package com.back.nbe1214finalsour.domain.chat.controller;

import com.back.nbe1214finalsour.domain.chat.dto.ChatMessagePageResponse;
import com.back.nbe1214finalsour.domain.chat.service.ChatHistoryService;
import com.back.nbe1214finalsour.global.response.ApiResponse;
import com.back.nbe1214finalsour.global.security.AuthUser;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 채팅 이전 메시지 조회 (SCRUM-131, 계획 §3-1, D8) */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/chat")
public class ChatHistoryController {

    /** ULID 26자 (Crockford Base32, 대문자). 저장된 messageId와 같은 형식만 받는다 */
    private static final String ULID_PATTERN = "^[0-9A-HJKMNP-TV-Z]{26}$";

    private final ChatHistoryService chatHistoryService;

    /**
     * 학교 채팅방의 메시지를 최신순으로 읽는다. 입장하면 {@code cursor} 없이 최신 20개, 위로 스크롤하면 받은 {@code nextCursor}로
     * 그 이전 20개를 읽는다. {@code size}는 1~20이고 기본 20이다.
     */
    @GetMapping("/universities/{universityId}/messages")
    public ApiResponse<ChatMessagePageResponse> getUniversityMessages(
            @PathVariable long universityId,
            @RequestParam(required = false) @Pattern(regexp = ULID_PATTERN) @Nullable String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(ChatHistoryService.MAX_PAGE_SIZE) int size,
            @AuthenticationPrincipal AuthUser authUser
    ) {
        return ApiResponse.ok(this.chatHistoryService.getUniversityMessages(authUser, universityId, cursor, size));
    }
}
