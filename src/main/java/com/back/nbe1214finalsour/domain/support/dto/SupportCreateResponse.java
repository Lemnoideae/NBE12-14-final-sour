package com.back.nbe1214finalsour.domain.support.dto;

import com.back.nbe1214finalsour.domain.support.entity.SupportStatus;

/** {@code POST /api/v1/supports} 응답 */
public record SupportCreateResponse(Long supportId, SupportStatus status) {
}
