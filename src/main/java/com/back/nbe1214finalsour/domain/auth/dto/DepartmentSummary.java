package com.back.nbe1214finalsour.domain.auth.dto;

import com.back.nbe1214finalsour.domain.university.entity.Department;

/** 응답에 넣는 학과 요약 ({@code {"id": 301, "name": "컴퓨터공학부"}}) */
public record DepartmentSummary(Long id, String name) {

    public static DepartmentSummary from(Department department) {
        return new DepartmentSummary(department.getId(), department.getName());
    }
}
