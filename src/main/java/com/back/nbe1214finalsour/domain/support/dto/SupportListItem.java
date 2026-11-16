package com.back.nbe1214finalsour.domain.support.dto;

import com.back.nbe1214finalsour.domain.support.entity.SupportStatus;
import java.time.OffsetDateTime;

/** 내 문의 목록 한 줄 (추가 명세 §3-8). 본문·이메일은 읽지 않는다 */
public record SupportListItem(Long supportId, String title, SupportStatus status, OffsetDateTime createdAt) {
}
