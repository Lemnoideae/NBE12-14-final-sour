package com.back.nbe1214finalsour.domain.auth.dto;

import com.back.nbe1214finalsour.domain.university.entity.University;

/** 응답에 넣는 학교 요약 ({@code {"id": 12, "name": "서울대학교"}}) */
public record UniversitySummary(Long id, String name) {

    public static UniversitySummary from(University university) {
        return new UniversitySummary(university.getId(), university.getName());
    }
}
