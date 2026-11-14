package com.back.nbe1214finalsour.domain.user.dto;

import com.back.nbe1214finalsour.domain.user.validation.Nickname;

/**
 * {@code PATCH /api/v1/users/me} 요청 (추가 명세 §3-1). 바꿀 필드만 보낸다. 빠지거나 {@code null}인 필드는 그대로 둔다.
 * 프로필 이미지를 지우는 기능은 없다 (계획 Q3).
 *
 * @param nickname        규칙은 {@link Nickname}
 * @param profileImageUrl 업로드 URL 발급 API가 준 우리 CDN 주소만 받는다 ({@code ProfileImageUrlPolicy})
 */
public record UpdateProfileRequest(@Nickname String nickname, String profileImageUrl) {
}
