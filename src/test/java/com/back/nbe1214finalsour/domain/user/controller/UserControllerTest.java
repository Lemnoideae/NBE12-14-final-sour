package com.back.nbe1214finalsour.domain.user.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.nbe1214finalsour.domain.user.service.UserService;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.exception.GlobalExceptionHandler;
import com.back.nbe1214finalsour.global.security.ApiAccessDeniedHandler;
import com.back.nbe1214finalsour.global.security.ApiAuthenticationEntryPoint;
import com.back.nbe1214finalsour.global.security.ApiResponseWriter;
import com.back.nbe1214finalsour.global.security.AuthUser;
import com.back.nbe1214finalsour.global.security.CorsConfig;
import com.back.nbe1214finalsour.global.security.Role;
import com.back.nbe1214finalsour.global.security.SecurityConfig;
import com.back.nbe1214finalsour.global.security.jwt.JwtProvider;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@WebMvcTest(UserController.class)
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
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @Autowired
    private JwtProvider jwtProvider;

    @Test
    @DisplayName("[GET] /api/v1/users/nickname/availability는 토큰 없이 사용 가능 여부를 200으로 응답")
    void checkNickname() throws Exception {
        given(userService.isNicknameAvailable("대대대짱")).willReturn(false);

        mockMvc.perform(get("/api/v1/users/nickname/availability").param("nickname", "대대대짱"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.available").value(false));
    }

    @ParameterizedTest(name = "nickname=\"{0}\"")
    @ValueSource(strings = {"", "대", "가나다라마바사아자차카타파", " 대대대"})
    @DisplayName("[GET] /api/v1/users/nickname/availability는 닉네임 규칙(앞뒤 공백 없이 2~12자)을 어기면 400 COMMON_INVALID_INPUT")
    void checkNickname_invalid(String nickname) throws Exception {
        mockMvc.perform(get("/api/v1/users/nickname/availability").param("nickname", nickname))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.data[0].field").value("nickname"));

        verify(userService, never()).isNicknameAvailable(anyString());
    }

    @Test
    @DisplayName("[GET] /api/v1/users/nickname/availability는 nickname 파라미터가 없으면 400 COMMON_INVALID_INPUT")
    void checkNickname_missing() throws Exception {
        mockMvc.perform(get("/api/v1/users/nickname/availability"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
    }

    // ===== 비밀번호 변경 (SCRUM-78) =====

    @Test
    @DisplayName("[PATCH] /api/v1/users/me/password는 비밀번호를 바꾸고 204와 Max-Age=0 refresh 쿠키로 응답")
    void changePassword() throws Exception {
        changePassword(passwordBody("Passw0rd!", "N3wPassw0rd!"))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", allOf(
                        startsWith("refreshToken=;"),
                        containsString("Path=/api/v1/auth"),
                        containsString("Max-Age=0"),
                        containsString("Secure"),
                        containsString("HttpOnly"),
                        containsString("SameSite=Strict"))));

        verify(userService).changePassword(1024L, "Passw0rd!", "N3wPassw0rd!");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidPasswordChanges")
    @DisplayName("[PATCH] /api/v1/users/me/password는 입력 규칙을 어기면 400 COMMON_INVALID_INPUT, 서비스를 부르지 않음")
    void changePassword_invalidInput(String reason, String body, String field) throws Exception {
        changePassword(body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.data[0].field").value(field));

        verify(userService, never()).changePassword(any(), any(), any());
    }

    static Stream<Arguments> invalidPasswordChanges() {
        return Stream.of(
                Arguments.of("새 비밀번호 7자", passwordBody("Passw0rd!", "Pass0r!"), "newPassword"),
                Arguments.of("새 비밀번호 65자", passwordBody("Passw0rd!", "Passw0rd!" + "a".repeat(56)), "newPassword"),
                Arguments.of("새 비밀번호 특수문자 없음", passwordBody("Passw0rd!", "Passw0rdd"), "newPassword"),
                Arguments.of("새 비밀번호 공백 포함", passwordBody("Passw0rd!", "Pass w0rd!"), "newPassword"),
                Arguments.of("새 비밀번호 없음", "{\"currentPassword\":\"Passw0rd!\"}", "newPassword"),
                Arguments.of("현재 비밀번호 없음", "{\"newPassword\":\"N3wPassw0rd!\"}", "currentPassword"),
                Arguments.of("현재 비밀번호 65자", passwordBody("a".repeat(65), "N3wPassw0rd!"), "currentPassword"));
    }

    @Test
    @DisplayName("[PATCH] /api/v1/users/me/password 검증 실패 로그에 비밀번호 원문이 남지 않는다")
    void changePassword_invalidPasswordIsNotLogged(CapturedOutput output) throws Exception {
        changePassword(passwordBody("MyCurrentPw1!", "MySecretPw"))
                .andExpect(status().isBadRequest());

        assertThat(output).contains("newPassword").doesNotContain("MySecretPw").doesNotContain("MyCurrentPw1!");
    }

    @Test
    @DisplayName("[PATCH] /api/v1/users/me/password는 현재 비밀번호가 다르면 400 USER_INVALID_PASSWORD이고 쿠키를 지우지 않음")
    void changePassword_wrongCurrentPassword() throws Exception {
        willThrow(new BusinessException(ErrorCode.USER_INVALID_PASSWORD))
                .given(userService).changePassword(1024L, "Wr0ngPass!", "N3wPassw0rd!");

        changePassword(passwordBody("Wr0ngPass!", "N3wPassw0rd!"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("USER_INVALID_PASSWORD"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    @DisplayName("[PATCH] /api/v1/users/me/password는 access 토큰이 없으면 401 COMMON_UNAUTHORIZED")
    void changePassword_requiresAuthentication() throws Exception {
        mockMvc.perform(patch("/api/v1/users/me/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody("Passw0rd!", "N3wPassw0rd!")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("COMMON_UNAUTHORIZED"));

        verify(userService, never()).changePassword(any(), any(), any());
    }

    private ResultActions changePassword(String body) throws Exception {
        String accessToken = jwtProvider.createAccessToken(new AuthUser(1024L, 12L, Role.USER));
        return mockMvc.perform(patch("/api/v1/users/me/password")
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private static String passwordBody(String currentPassword, String newPassword) {
        return "{\"currentPassword\":\"" + currentPassword + "\",\"newPassword\":\"" + newPassword + "\"}";
    }
}
