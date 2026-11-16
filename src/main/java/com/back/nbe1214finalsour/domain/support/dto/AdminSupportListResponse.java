package com.back.nbe1214finalsour.domain.support.dto;

import com.back.nbe1214finalsour.domain.support.entity.CustomerSupport;
import java.util.List;
import org.springframework.data.domain.Page;

/** 관리자 문의 목록 (추가 명세 §3-9). 정렬은 최신순 (계획 D5) */
public record AdminSupportListResponse(
        List<AdminSupportListItem> items, int page, int size, long totalCount, boolean hasNext) {

    public static AdminSupportListResponse from(Page<CustomerSupport> result) {
        return new AdminSupportListResponse(result.map(AdminSupportListItem::from).getContent(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.hasNext());
    }
}
