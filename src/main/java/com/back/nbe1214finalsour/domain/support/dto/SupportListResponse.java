package com.back.nbe1214finalsour.domain.support.dto;

import java.util.List;
import org.springframework.data.domain.Page;

/** 내 문의 목록 (추가 명세 §3-8). 정렬은 최신순 (계획 D5) */
public record SupportListResponse(List<SupportListItem> items, int page, int size, long totalCount, boolean hasNext) {

    public static SupportListResponse from(Page<SupportListItem> result) {
        return new SupportListResponse(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.hasNext());
    }
}
