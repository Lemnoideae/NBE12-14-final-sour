package com.back.nbe1214finalsour.domain.support.dto;

import com.back.nbe1214finalsour.domain.support.entity.CustomerSupport;
import com.back.nbe1214finalsour.domain.support.entity.SupportStatus;
import java.time.OffsetDateTime;
import org.jspecify.annotations.Nullable;

/**
 * 관리자 문의 상세 (SCRUM-173, 계획 .agents/01-PLAN/261119-1038-scrum173_admin_supports.md B1). 회원 상세와 같은 본문·답변에
 * 관리자 목록의 수신 이메일(복호화한 원문)과 회원 여부를 더한다. 답변 전이면 {@code answer}는 {@code null}이다.
 */
public record AdminSupportDetailResponse(
        Long supportId,
        String title,
        String content,
        @Nullable String attachFileUrl,
        String recipientEmail,
        boolean isMember,
        SupportStatus status,
        SupportDetailResponse.@Nullable Answer answer,
        OffsetDateTime createdAt
) {

    public static AdminSupportDetailResponse from(CustomerSupport support) {
        SupportDetailResponse.Answer answer = support.getStatus() == SupportStatus.ANSWERED
                ? new SupportDetailResponse.Answer(support.getAnswerTitle(), support.getAnswerContent())
                : null;
        return new AdminSupportDetailResponse(support.getId(), support.getTitle(), support.getContent(),
                support.getAttachFileUrl(), support.getRecipientEmail(), support.isMember(), support.getStatus(),
                answer, support.getCreatedAt());
    }
}
