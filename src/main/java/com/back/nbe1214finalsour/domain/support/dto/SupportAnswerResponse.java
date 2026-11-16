package com.back.nbe1214finalsour.domain.support.dto;

import com.back.nbe1214finalsour.domain.support.entity.SupportStatus;

/** 관리자 문의 답변 결과 (추가 명세 §3-9) */
public record SupportAnswerResponse(Long supportId, SupportStatus status) {
}
