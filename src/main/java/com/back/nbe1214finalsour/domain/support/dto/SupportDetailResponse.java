package com.back.nbe1214finalsour.domain.support.dto;

import com.back.nbe1214finalsour.domain.support.entity.CustomerSupport;
import com.back.nbe1214finalsour.domain.support.entity.SupportStatus;
import java.time.OffsetDateTime;
import org.jspecify.annotations.Nullable;

/**
 * 문의 상세 (추가 명세 §3-8). 답변 전이면 {@code answer}는 {@code null}이다. 수신 이메일은 명세 응답에 없어 내보내지 않는다.
 */
public record SupportDetailResponse(
        Long supportId,
        String title,
        String content,
        @Nullable String attachFileUrl,
        SupportStatus status,
        @Nullable Answer answer,
        OffsetDateTime createdAt
) {

    public record Answer(String title, String content) {
    }

    public static SupportDetailResponse from(CustomerSupport support) {
        Answer answer = support.getStatus() == SupportStatus.ANSWERED
                ? new Answer(support.getAnswerTitle(), support.getAnswerContent())
                : null;
        return new SupportDetailResponse(support.getId(), support.getTitle(), support.getContent(),
                support.getAttachFileUrl(), support.getStatus(), answer, support.getCreatedAt());
    }
}
