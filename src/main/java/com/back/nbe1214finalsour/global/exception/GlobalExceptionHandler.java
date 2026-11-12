package com.back.nbe1214finalsour.global.exception;

import com.back.nbe1214finalsour.global.response.ApiResponse;
import com.back.nbe1214finalsour.global.response.FieldErrorDetail;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.Errors;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * 컨트롤러에서 나온 모든 예외를 {@link ApiResponse} 형식으로 응답한다.
 *
 * <p>Spring MVC 표준 예외(400·404·405·415 등)는 부모 클래스가 HTTP 상태를 정하고,
 * {@link #handleExceptionInternal}에서 본문만 {@link ApiResponse}로 바꾼다.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Object> handleBusinessException(BusinessException ex, WebRequest request) {
        ErrorCode errorCode = ex.getErrorCode();
        return handleExceptionInternal(ex, ApiResponse.fail(errorCode), new HttpHeaders(), errorCode.getStatus(), request);
    }

    /**
     * 인가 실패는 여기서 응답하지 않고 Spring Security로 돌려보낸다.
     * 그래야 비로그인 사용자는 401, 로그인 사용자는 403으로 Security 핸들러가 나눠 응답한다.
     * 이 메서드가 없으면 {@link #handleUnexpected}가 잡아 500이 된다.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public void rethrowAccessDenied(AccessDeniedException ex) {
        throw ex;
    }

    /** 처리되지 않은 모든 예외. 내부 메시지는 로그에만 남기고 응답에는 넣지 않는다. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleUnexpected(Exception ex, WebRequest request) {
        ErrorCode errorCode = ErrorCode.COMMON_INTERNAL_ERROR;
        return handleExceptionInternal(ex, ApiResponse.fail(errorCode), new HttpHeaders(), errorCode.getStatus(), request);
    }

    /** {@code @Valid @RequestBody} 검증 실패 */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<FieldErrorDetail> details = toDetails(ex.getBindingResult());
        return handleExceptionInternal(ex, ApiResponse.fail(ErrorCode.COMMON_INVALID_INPUT, details), headers, status, request);
    }

    /** 컨트롤러 메서드 파라미터 검증 실패 ({@code @RequestParam @Max(100)} 등) */
    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(
            HandlerMethodValidationException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<FieldErrorDetail> details = new ArrayList<>();
        for (ParameterValidationResult result : ex.getParameterValidationResults()) {
            if (result instanceof ParameterErrors errors) {
                details.addAll(toDetails(errors));
                continue;
            }
            String name = parameterName(result.getMethodParameter());
            result.getResolvableErrors()
                    .forEach(error -> details.add(new FieldErrorDetail(name, error.getDefaultMessage())));
        }
        return handleExceptionInternal(ex, ApiResponse.fail(ErrorCode.COMMON_INVALID_INPUT, details), headers, status, request);
    }

    /**
     * 이 클래스가 만드는 모든 오류 응답이 거치는 지점. 본문을 {@link ApiResponse}로 바꾸고
     * Content-Type을 JSON으로 고정한다 (클라이언트 Accept와 무관하게 같은 형식으로 응답).
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, @Nullable Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        Object apiBody = body instanceof ApiResponse<?> ? body : ApiResponse.fail(ErrorCode.commonFor(statusCode));
        HttpHeaders jsonHeaders = HttpHeaders.copyOf(headers);
        jsonHeaders.setContentType(MediaType.APPLICATION_JSON);
        logByStatus(statusCode, ex, request);
        return super.handleExceptionInternal(ex, apiBody, jsonHeaders, statusCode, request);
    }

    private static List<FieldErrorDetail> toDetails(Errors errors) {
        List<FieldErrorDetail> details = new ArrayList<>();
        for (FieldError error : errors.getFieldErrors()) {
            details.add(new FieldErrorDetail(error.getField(), error.getDefaultMessage()));
        }
        for (ObjectError error : errors.getGlobalErrors()) {
            details.add(new FieldErrorDetail(error.getObjectName(), error.getDefaultMessage()));
        }
        return details;
    }

    /** 클라이언트가 보낸 이름(@RequestParam·@PathVariable의 name)을 우선 쓴다. */
    private static String parameterName(MethodParameter parameter) {
        RequestParam requestParam = parameter.getParameterAnnotation(RequestParam.class);
        if (requestParam != null && !requestParam.name().isEmpty()) {
            return requestParam.name();
        }
        PathVariable pathVariable = parameter.getParameterAnnotation(PathVariable.class);
        if (pathVariable != null && !pathVariable.name().isEmpty()) {
            return pathVariable.name();
        }
        return parameter.getParameterName();
    }

    /** 4xx는 클라이언트 원인이라 스택 없이 warn, 5xx는 서버 원인이라 스택과 함께 error. */
    private static void logByStatus(HttpStatusCode status, Exception ex, WebRequest request) {
        String where = request.getDescription(false);
        if (status.is5xxServerError()) {
            log.error("{} {} {}", status.value(), where, ex.getClass().getSimpleName(), ex);
        } else {
            log.warn("{} {} {}: {}", status.value(), where, ex.getClass().getSimpleName(), ex.getMessage());
        }
    }
}
