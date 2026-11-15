package com.back.nbe1214finalsour.domain.user.dto;

import com.back.nbe1214finalsour.domain.user.entity.UserStatus;

/** {@code PATCH /api/v1/admin/users/{userId}/status} 응답 (추가 명세 §3-9) */
public record AdminUserStatusResponse(Long userId, UserStatus status) {
}
