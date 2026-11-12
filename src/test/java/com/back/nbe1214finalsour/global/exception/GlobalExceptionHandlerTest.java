package com.back.nbe1214finalsour.global.exception;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 컨트롤러 예외가 API 명세서 §1 형식({code, message, data})으로 응답되는지 확인한다.
 * Security 필터의 401/403 응답은 SCRUM-51에서 따로 검증하므로 여기서는 필터를 끈다.
 */
@WebMvcTest(controllers = GlobalExceptionHandlerTest.TestController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandlerTest.TestController.class)
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @Nested
    @DisplayName("BusinessException")
    class Business {

        @Test
        @DisplayName("ErrorCode의 HTTP 상태·코드·메시지로 응답하고 로그용 detail은 노출하지 않는다")
        void usesErrorCode() throws Exception {
            mockMvc.perform(get("/test/business"))
                    .andExpect(status().isForbidden())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.code").value("COMMON_FORBIDDEN"))
                    .andExpect(jsonPath("$.message").value("권한이 없습니다."))
                    .andExpect(jsonPath("$.data").isEmpty())
                    .andExpect(content().string(not(containsString("internal-detail"))));
        }

        @Test
        @DisplayName("클라이언트가 JSON이 아닌 Accept를 보내도 JSON으로 응답한다")
        void ignoresAcceptHeader() throws Exception {
            mockMvc.perform(get("/test/business").accept(MediaType.TEXT_PLAIN))
                    .andExpect(status().isForbidden())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.code").value("COMMON_FORBIDDEN"));
        }
    }

    @Nested
    @DisplayName("입력 오류는 400 COMMON_INVALID_INPUT")
    class InvalidInput {

        @Test
        @DisplayName("@Valid 본문 검증 실패는 data에 필드별 오류를 담는다")
        void bodyValidation() throws Exception {
            mockMvc.perform(post("/test/body")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"nickname\":\"\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.message").value("입력값이 올바르지 않습니다."))
                    .andExpect(jsonPath("$.data[0].field").value("nickname"))
                    .andExpect(jsonPath("$.data[0].reason").value("닉네임은 필수입니다."));
        }

        @Test
        @DisplayName("요청 파라미터 검증 실패는 클라이언트가 보낸 파라미터 이름으로 오류를 담는다")
        void parameterValidation() throws Exception {
            mockMvc.perform(get("/test/param").param("size", "101"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.data[0].field").value("size"))
                    .andExpect(jsonPath("$.data[0].reason").value("size는 100 이하여야 합니다."));
        }

        @Test
        @DisplayName("깨진 JSON")
        void malformedJson() throws Exception {
            mockMvc.perform(post("/test/body")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"nickname\":"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.data").isEmpty());
        }

        @Test
        @DisplayName("경로 변수 타입 불일치")
        void typeMismatch() throws Exception {
            mockMvc.perform(get("/test/items/abc"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
        }

        @Test
        @DisplayName("필수 파라미터 누락")
        void missingParameter() throws Exception {
            mockMvc.perform(get("/test/required"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
        }
    }

    @Nested
    @DisplayName("Spring MVC 표준 예외는 원래 HTTP 상태를 유지한다")
    class FrameworkErrors {

        @Test
        @DisplayName("없는 경로는 404 COMMON_NOT_FOUND")
        void notFound() throws Exception {
            mockMvc.perform(get("/test/nowhere"))
                    .andExpect(status().isNotFound())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.code").value("COMMON_NOT_FOUND"));
        }

        @Test
        @DisplayName("지원하지 않는 메서드는 405 COMMON_METHOD_NOT_ALLOWED이고 Allow 헤더를 유지한다")
        void methodNotAllowed() throws Exception {
            mockMvc.perform(delete("/test/business"))
                    .andExpect(status().isMethodNotAllowed())
                    .andExpect(header().string("Allow", containsString("GET")))
                    .andExpect(jsonPath("$.code").value("COMMON_METHOD_NOT_ALLOWED"));
        }

        @Test
        @DisplayName("JSON이 아닌 본문은 415 COMMON_UNSUPPORTED_MEDIA_TYPE")
        void unsupportedMediaType() throws Exception {
            mockMvc.perform(post("/test/body").contentType(MediaType.TEXT_PLAIN).content("nickname"))
                    .andExpect(status().isUnsupportedMediaType())
                    .andExpect(jsonPath("$.code").value("COMMON_UNSUPPORTED_MEDIA_TYPE"));
        }

        @Test
        @DisplayName("전용 코드가 없는 4xx는 상태를 유지하고 COMMON_INVALID_INPUT")
        void otherClientError() throws Exception {
            mockMvc.perform(get("/test/conflict"))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
        }
    }

    @Test
    @DisplayName("처리되지 않은 예외는 500 COMMON_INTERNAL_ERROR이고 예외 메시지를 노출하지 않는다")
    void unexpectedException() throws Exception {
        mockMvc.perform(get("/test/unexpected"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("COMMON_INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("서버 오류가 발생했습니다."))
                .andExpect(content().string(not(containsString("password"))))
                .andExpect(content().string(not(containsString("IllegalStateException"))));
    }

    @Test
    @DisplayName("인가 실패는 500으로 삼키지 않고 Spring Security가 처리하도록 다시 던진다")
    void accessDeniedIsRethrown() {
        assertThatThrownBy(() -> mockMvc.perform(get("/test/access-denied")))
                .rootCause()
                .isInstanceOf(AccessDeniedException.class);
    }

    record SampleRequest(@NotBlank(message = "닉네임은 필수입니다.") String nickname) {
    }

    @RestController
    @RequestMapping("/test")
    static class TestController {

        @GetMapping("/business")
        String business() {
            throw new BusinessException(ErrorCode.COMMON_FORBIDDEN, "internal-detail");
        }

        @PostMapping("/body")
        String body(@Valid @RequestBody SampleRequest request) {
            return request.nickname();
        }

        @GetMapping("/param")
        int param(@RequestParam("size") @Max(value = 100, message = "size는 100 이하여야 합니다.") int pageSize) {
            return pageSize;
        }

        @GetMapping("/items/{itemId}")
        long item(@PathVariable long itemId) {
            return itemId;
        }

        @GetMapping("/required")
        String required(@RequestParam String keyword) {
            return keyword;
        }

        @GetMapping("/conflict")
        String conflict() {
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        }

        @GetMapping("/unexpected")
        String unexpected() {
            throw new IllegalStateException("db password=secret");
        }

        @GetMapping("/access-denied")
        String accessDenied() {
            throw new AccessDeniedException("denied");
        }
    }
}
