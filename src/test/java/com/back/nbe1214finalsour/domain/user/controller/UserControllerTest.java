package com.back.nbe1214finalsour.domain.user.controller;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.nbe1214finalsour.domain.user.service.UserService;
import com.back.nbe1214finalsour.global.exception.GlobalExceptionHandler;
import com.back.nbe1214finalsour.global.security.ApiAccessDeniedHandler;
import com.back.nbe1214finalsour.global.security.ApiAuthenticationEntryPoint;
import com.back.nbe1214finalsour.global.security.ApiResponseWriter;
import com.back.nbe1214finalsour.global.security.CorsConfig;
import com.back.nbe1214finalsour.global.security.SecurityConfig;
import com.back.nbe1214finalsour.global.security.jwt.JwtProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

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
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

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
}
