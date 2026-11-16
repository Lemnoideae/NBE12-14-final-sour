package com.back.nbe1214finalsour.domain.support.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 관리자 문의 답변 (추가 명세 §3-9). 길이는 계획 D2 */
public record SupportAnswerRequest(
        @NotBlank @Size(max = 100) String answerTitle,
        @NotBlank @Size(max = 5000) String answerContent
) {
}
