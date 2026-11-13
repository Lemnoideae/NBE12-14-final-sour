package com.back.nbe1214finalsour.domain.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.nbe1214finalsour.domain.auth.dto.EmailCodeResponse;
import com.back.nbe1214finalsour.domain.auth.dto.DepartmentSummary;
import com.back.nbe1214finalsour.domain.auth.dto.EmailVerifyResponse;
import com.back.nbe1214finalsour.domain.auth.dto.SignupRequest;
import com.back.nbe1214finalsour.domain.auth.dto.SignupResponse;
import com.back.nbe1214finalsour.domain.auth.dto.UniversitySummary;
import com.back.nbe1214finalsour.domain.auth.service.EmailVerificationService;
import com.back.nbe1214finalsour.domain.auth.service.SignupService;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.exception.GlobalExceptionHandler;
import com.back.nbe1214finalsour.global.security.ApiAccessDeniedHandler;
import com.back.nbe1214finalsour.global.security.ApiAuthenticationEntryPoint;
import com.back.nbe1214finalsour.global.security.ApiResponseWriter;
import com.back.nbe1214finalsour.global.security.CorsConfig;
import com.back.nbe1214finalsour.global.security.SecurityConfig;
import com.back.nbe1214finalsour.global.security.jwt.JwtProvider;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import({
        SecurityConfig.class,
        CorsConfig.class,
        JwtProvider.class,
        ApiAuthenticationEntryPoint.class,
        ApiAccessDeniedHandler.class,
        ApiResponseWriter.class,
        GlobalExceptionHandler.class
})
@ExtendWith(OutputCaptureExtension.class)
class AuthControllerTest {

    private static final UniversitySummary SNU = new UniversitySummary(12L, "서울대학교");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EmailVerificationService emailVerificationService;

    @MockitoBean
    private SignupService signupService;

    @Test
    @DisplayName("[POST] /api/v1/auth/email/code는 토큰 없이 학교와 유효 시간을 200으로 응답")
    void requestEmailCode() throws Exception {
        given(emailVerificationService.requestCode("student@snu.ac.kr")).willReturn(new EmailCodeResponse(SNU, 300));

        mockMvc.perform(post("/api/v1/auth/email/code")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"student@snu.ac.kr\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.university.id").value(12))
                .andExpect(jsonPath("$.data.university.name").value("서울대학교"))
                .andExpect(jsonPath("$.data.expiresInSeconds").value(300));
    }

    @Test
    @DisplayName("[POST] /api/v1/auth/email/verify는 가입 토큰과 학교, 유효 시간을 200으로 응답")
    void verifyEmailCode() throws Exception {
        given(emailVerificationService.verifyCode("student@snu.ac.kr", "482913")).willReturn(
                new EmailVerifyResponse("c1f0e7a2-4b1d-4a3e-9f1a-2d7c8e5b6a90", SNU, 1800));

        mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"student@snu.ac.kr\",\"code\":\"482913\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.signupToken").value("c1f0e7a2-4b1d-4a3e-9f1a-2d7c8e5b6a90"))
                .andExpect(jsonPath("$.data.university.id").value(12))
                .andExpect(jsonPath("$.data.expiresInSeconds").value(1800));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidCodeRequests")
    @DisplayName("[POST] /api/v1/auth/email/code는 이메일 형식이 틀리면 400 COMMON_INVALID_INPUT, 서비스를 부르지 않음")
    void requestEmailCode_invalidInput(String body) throws Exception {
        mockMvc.perform(post("/api/v1/auth/email/code").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.data[0].field").value("email"));

        verify(emailVerificationService, never()).requestCode(anyString());
    }

    static Stream<String> invalidCodeRequests() {
        return Stream.of("{}", "{\"email\":\"\"}", "{\"email\":\"not-an-email\"}");
    }

    @ParameterizedTest(name = "code={0}")
    @MethodSource("invalidCodes")
    @DisplayName("[POST] /api/v1/auth/email/verify는 코드가 숫자 6자리가 아니면 400 COMMON_INVALID_INPUT (실패 횟수에 넣지 않음)")
    void verifyEmailCode_invalidCodeFormat(String code) throws Exception {
        mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"student@snu.ac.kr\",\"code\":\"" + code + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.data[0].field").value("code"));

        verify(emailVerificationService, never()).verifyCode(anyString(), anyString());
    }

    static Stream<String> invalidCodes() {
        return Stream.of("", "12345", "1234567", "12a456");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("codeErrors")
    @DisplayName("[POST] /api/v1/auth/email/code의 도메인 오류는 명세서의 HTTP 상태와 코드로 응답")
    void requestEmailCode_businessErrors(ErrorCode errorCode, int status) throws Exception {
        given(emailVerificationService.requestCode(anyString())).willThrow(new BusinessException(errorCode));

        mockMvc.perform(post("/api/v1/auth/email/code")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"student@snu.ac.kr\"}"))
                .andExpect(status().is(status))
                .andExpect(jsonPath("$.code").value(errorCode.getCode()));
    }

    static Stream<Arguments> codeErrors() {
        return Stream.of(
                Arguments.of(ErrorCode.AUTH_UNSUPPORTED_DOMAIN, 400),
                Arguments.of(ErrorCode.AUTH_EMAIL_ALREADY_REGISTERED, 409),
                Arguments.of(ErrorCode.AUTH_CODE_COOLDOWN, 429));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("verifyErrors")
    @DisplayName("[POST] /api/v1/auth/email/verify의 도메인 오류는 명세서의 HTTP 상태와 코드로 응답")
    void verifyEmailCode_businessErrors(ErrorCode errorCode, int status) throws Exception {
        given(emailVerificationService.verifyCode(anyString(), anyString())).willThrow(new BusinessException(errorCode));

        mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"student@snu.ac.kr\",\"code\":\"482913\"}"))
                .andExpect(status().is(status))
                .andExpect(jsonPath("$.code").value(errorCode.getCode()));
    }

    static Stream<Arguments> verifyErrors() {
        return Stream.of(
                Arguments.of(ErrorCode.AUTH_INVALID_CODE, 400),
                Arguments.of(ErrorCode.AUTH_CODE_EXPIRED, 410),
                Arguments.of(ErrorCode.AUTH_CODE_ATTEMPTS_EXCEEDED, 429));
    }

    // ===== 회원가입 =====

    private static final String TOKEN = "c1f0e7a2-4b1d-4a3e-9f1a-2d7c8e5b6a90";

    @Test
    @DisplayName("[POST] /api/v1/auth/signup은 토큰 없이 가입하고 회원·학교·학과를 201로 응답")
    void signup() throws Exception {
        given(signupService.signup(any())).willReturn(new SignupResponse(1024L, "대대대짱", SNU,
                new DepartmentSummary(301L, "컴퓨터공학부")));

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody("대대대짱", "Passw0rd!", 301)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.userId").value(1024))
                .andExpect(jsonPath("$.data.nickname").value("대대대짱"))
                .andExpect(jsonPath("$.data.university.id").value(12))
                .andExpect(jsonPath("$.data.department.id").value(301))
                .andExpect(jsonPath("$.data.department.name").value("컴퓨터공학부"));

        verify(signupService).signup(new SignupRequest(TOKEN, "대대대짱", "Passw0rd!", 301L));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidSignupRequests")
    @DisplayName("[POST] /api/v1/auth/signup은 닉네임·비밀번호·학과 규칙을 어기면 400 COMMON_INVALID_INPUT, 서비스를 부르지 않음")
    void signup_invalidInput(String reason, String body, String field) throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.data[0].field").value(field));

        verify(signupService, never()).signup(any());
    }

    static Stream<Arguments> invalidSignupRequests() {
        return Stream.of(
                Arguments.of("닉네임 1자", signupBody("대", "Passw0rd!", 301), "nickname"),
                Arguments.of("닉네임 13자", signupBody("가".repeat(13), "Passw0rd!", 301), "nickname"),
                Arguments.of("닉네임 앞 공백", signupBody(" 대대대", "Passw0rd!", 301), "nickname"),
                Arguments.of("비밀번호 7자", signupBody("대대대짱", "Pass0r!", 301), "password"),
                Arguments.of("비밀번호 65자", signupBody("대대대짱", "Passw0rd!" + "a".repeat(56), 301), "password"),
                Arguments.of("비밀번호 숫자 없음", signupBody("대대대짱", "Password!", 301), "password"),
                Arguments.of("비밀번호 영문 없음", signupBody("대대대짱", "12345678!", 301), "password"),
                Arguments.of("비밀번호 특수문자 없음", signupBody("대대대짱", "Passw0rdd", 301), "password"),
                Arguments.of("비밀번호 공백 포함", signupBody("대대대짱", "Pass w0rd!", 301), "password"),
                Arguments.of("비밀번호 한글 포함", signupBody("대대대짱", "Passw0rd!한", 301), "password"),
                Arguments.of("학과 0", signupBody("대대대짱", "Passw0rd!", 0), "departmentId"),
                Arguments.of("가입 토큰 없음",
                        "{\"nickname\":\"대대대짱\",\"password\":\"Passw0rd!\",\"departmentId\":301}", "signupToken"));
    }

    @Test
    @DisplayName("[POST] /api/v1/auth/signup 검증 실패 로그에 비밀번호 원문이 남지 않는다")
    void signup_invalidPasswordIsNotLogged(CapturedOutput output) throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody("대대대짱", "MySecretPw", 301)))
                .andExpect(status().isBadRequest());

        assertThat(output).contains("password").doesNotContain("MySecretPw");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("signupErrors")
    @DisplayName("[POST] /api/v1/auth/signup의 도메인 오류는 명세서의 HTTP 상태와 코드로 응답")
    void signup_businessErrors(ErrorCode errorCode, int status) throws Exception {
        given(signupService.signup(any())).willThrow(new BusinessException(errorCode));

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody("대대대짱", "Passw0rd!", 301)))
                .andExpect(status().is(status))
                .andExpect(jsonPath("$.code").value(errorCode.getCode()));
    }

    static Stream<Arguments> signupErrors() {
        return Stream.of(
                Arguments.of(ErrorCode.AUTH_INVALID_SIGNUP_TOKEN, 400),
                Arguments.of(ErrorCode.USER_DEPARTMENT_MISMATCH, 400),
                Arguments.of(ErrorCode.USER_NICKNAME_DUPLICATED, 409),
                Arguments.of(ErrorCode.AUTH_EMAIL_ALREADY_REGISTERED, 409));
    }

    private static String signupBody(String nickname, String password, long departmentId) {
        return "{\"signupToken\":\"" + TOKEN + "\",\"nickname\":\"" + nickname + "\",\"password\":\"" + password
                + "\",\"departmentId\":" + departmentId + "}";
    }
}
