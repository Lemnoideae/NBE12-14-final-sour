package com.back.nbe1214finalsour.domain.support.dto;

import com.back.nbe1214finalsour.domain.support.entity.CustomerSupport;
import com.back.nbe1214finalsour.domain.support.entity.SupportStatus;
import java.time.OffsetDateTime;

/** 관리자 문의 목록 한 줄 (추가 명세 §3-9). {@code recipientEmail}은 복호화한 원문이다 */
public record AdminSupportListItem(
        Long supportId,
        String title,
        String recipientEmail,
        boolean isMember,
        SupportStatus status,
        OffsetDateTime createdAt
) {

    public static AdminSupportListItem from(CustomerSupport support) {
        return new AdminSupportListItem(support.getId(), support.getTitle(), support.getRecipientEmail(),
                support.isMember(), support.getStatus(), support.getCreatedAt());
    }
}
