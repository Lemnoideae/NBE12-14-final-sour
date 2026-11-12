package com.back.nbe1214finalsour.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * 모든 API 오류 코드.
 *
 * <p>규칙 (API 명세서 §1 공통 에러 코드)
 * <ul>
 *   <li>상수 이름과 {@code code} 문자열을 같게 쓴다.</li>
 *   <li>코드는 {@code 도메인접두어_의미} 형식이다. 예: {@code USER_NOT_FOUND}</li>
 *   <li>자기 도메인 구역의 끝에만 추가한다. 여러 명이 이 파일을 함께 고치므로 머지 충돌을 줄이기 위함이다.</li>
 * </ul>
 */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // ===== COMMON =====
    COMMON_INVALID_INPUT(HttpStatus.BAD_REQUEST, "COMMON_INVALID_INPUT", "입력값이 올바르지 않습니다."),
    COMMON_UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "COMMON_UNAUTHORIZED", "로그인이 필요합니다."),
    COMMON_INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "COMMON_INVALID_TOKEN", "유효하지 않은 토큰입니다."),
    COMMON_EXPIRED_TOKEN(HttpStatus.UNAUTHORIZED, "COMMON_EXPIRED_TOKEN", "토큰이 만료되었습니다."),
    COMMON_FORBIDDEN(HttpStatus.FORBIDDEN, "COMMON_FORBIDDEN", "권한이 없습니다."),
    COMMON_NOT_FOUND(HttpStatus.NOT_FOUND, "COMMON_NOT_FOUND", "요청한 경로를 찾을 수 없습니다."),
    COMMON_METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "COMMON_METHOD_NOT_ALLOWED", "지원하지 않는 HTTP 메서드입니다."),
    COMMON_UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "COMMON_UNSUPPORTED_MEDIA_TYPE", "지원하지 않는 Content-Type입니다."),
    COMMON_INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "COMMON_INTERNAL_ERROR", "서버 오류가 발생했습니다."),

    // ===== AUTH (1번) =====

    // ===== USER (1번) =====

    // ===== CLICK (2번) =====

    // ===== UNIV / RANK (3번) =====

    // ===== ALLY / MATCH / GUEST (3번) =====

    // ===== CLICKER / ITEM / PAY (4번) =====
    ;

    private final HttpStatus status;
    private final String code;
    private final String message;
}
