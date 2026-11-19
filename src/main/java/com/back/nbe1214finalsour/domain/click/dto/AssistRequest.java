package com.back.nbe1214finalsour.domain.click.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** 연합 학교 지원 요청 (추가 명세 §3-3). 검증은 공격 요청과 같다 */
public record AssistRequest(
        @NotBlank(message = "고유한 제출 ID가 필요합니다.")
        String submissionId,
        @NotNull(message = "클릭 횟수가 필요합니다.")
        @Min(value = 1, message = "최소 1 이상의 클릭 횟수가 필요합니다.")
        @Max(value = 20, message = "부정 행위를 감지했습니다.")
        Integer clickCount,
        @NotNull(message = "지원할 학교의 ID를 입력해주세요.")
        Long targetUniversityId
) {
}
