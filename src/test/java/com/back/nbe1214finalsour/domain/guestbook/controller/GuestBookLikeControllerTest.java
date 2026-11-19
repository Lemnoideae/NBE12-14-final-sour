package com.back.nbe1214finalsour.domain.guestbook.controller;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.nbe1214finalsour.domain.guestbook.dto.GuestBookLikeResponse;
import com.back.nbe1214finalsour.domain.guestbook.service.GuestBookLikeService;
import com.back.nbe1214finalsour.global.exception.GlobalExceptionHandler;
import com.back.nbe1214finalsour.global.security.ApiAccessDeniedHandler;
import com.back.nbe1214finalsour.global.security.ApiAuthenticationEntryPoint;
import com.back.nbe1214finalsour.global.security.ApiResponseWriter;
import com.back.nbe1214finalsour.global.security.AuthUser;
import com.back.nbe1214finalsour.global.security.CorsConfig;
import com.back.nbe1214finalsour.global.security.LoginSessionStore;
import com.back.nbe1214finalsour.global.security.Role;
import com.back.nbe1214finalsour.global.security.SecurityConfig;
import com.back.nbe1214finalsour.global.security.jwt.JwtProvider;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(GuestBookLikeController.class)
@Import({SecurityConfig.class, CorsConfig.class, JwtProvider.class,
        ApiAuthenticationEntryPoint.class, ApiAccessDeniedHandler.class,
        ApiResponseWriter.class, GlobalExceptionHandler.class})
class GuestBookLikeControllerTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean GuestBookLikeService service;
    @MockitoBean LoginSessionStore loginSessionStore;

    @Test
    void loggedInUser_canLike() throws Exception {
        AuthUser principal = new AuthUser(7L, 2L, 3L, Role.USER);
        var auth = UsernamePasswordAuthenticationToken.authenticated(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        given(service.like(3301L, 7L)).willReturn(new GuestBookLikeResponse(3301L, true, 13));

        mockMvc.perform(post("/api/v1/guestbooks/3301/likes").with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.guestbookId").value(3301))
                .andExpect(jsonPath("$.data.liked").value(true))
                .andExpect(jsonPath("$.data.likeCount").value(13));
        verify(service).like(3301L, 7L);
    }

    @Test
    void anonymousUser_cannotLike() throws Exception {
        mockMvc.perform(post("/api/v1/guestbooks/3301/likes"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("COMMON_UNAUTHORIZED"));
    }
}
