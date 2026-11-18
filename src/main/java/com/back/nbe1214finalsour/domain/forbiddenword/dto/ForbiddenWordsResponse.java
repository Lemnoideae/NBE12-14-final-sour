package com.back.nbe1214finalsour.domain.forbiddenword.dto;

import java.util.List;

/** 금칙어 목록 화면 (계획 D19) */
public record ForbiddenWordsResponse(List<String> words) {
}
