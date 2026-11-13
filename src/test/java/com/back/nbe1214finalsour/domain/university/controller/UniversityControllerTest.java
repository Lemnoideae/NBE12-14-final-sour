package com.back.nbe1214finalsour.domain.university.controller;

import com.back.nbe1214finalsour.domain.university.dto.DepartmentResponse;
import com.back.nbe1214finalsour.domain.university.dto.UniversitySearchResponse;
import com.back.nbe1214finalsour.domain.university.service.UniversityQueryService;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.exception.GlobalExceptionHandler;
import com.back.nbe1214finalsour.global.security.*;
import com.back.nbe1214finalsour.global.security.jwt.JwtProvider;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UniversityController.class)
@Import({
        SecurityConfig.class,
        CorsConfig.class,
        JwtProvider.class,
        ApiAuthenticationEntryPoint.class,
        ApiAccessDeniedHandler.class,
        ApiResponseWriter.class,
        GlobalExceptionHandler.class
})
class UniversityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UniversityQueryService universityQueryService;

    @Test
    @DisplayName("학교 검색 시 200과 검색 결과를 반환한다")
    void searchUniversities() throws Exception {

        given(universityQueryService.searchUniversities("서울", 20))
                .willReturn(List.of(
                        new UniversitySearchResponse(12L, "서울대학교", null)
                ));

        mockMvc.perform(get("/api/v1/universities")
                        .param("keyword", "서울"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(12))
                .andExpect(jsonPath("$.data[0].name").value("서울대학교"))
                .andExpect(jsonPath("$.data[0].logoUrl").value((Object) null));

        verify(universityQueryService).searchUniversities("서울", 20);
    }

    @Test
    @DisplayName("size를 지정하면 해당 값으로 검색한다")
    void searchUniversities_customSize() throws Exception {

        given(universityQueryService.searchUniversities("서울", 5))
                .willReturn(List.of());

        mockMvc.perform(get("/api/v1/universities")
                        .param("keyword", "서울")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(0));

        verify(universityQueryService).searchUniversities("서울", 5);
    }

    @Test
    @DisplayName("size가 0이면 400을 반환한다")
    void searchUniversities_invalidSizeZero() throws Exception {
        mockMvc.perform(get("/api/v1/universities")
                        .param("keyword", "서울")
                        .param("size", "0"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("size가 100을 초과하면 400을 반환한다")
    void searchUniversities_invalidSizeOverMax() throws Exception {
        mockMvc.perform(get("/api/v1/universities")
                        .param("keyword", "서울")
                        .param("size", "101"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("검색어가 공백이면 400을 반환한다")
    void searchUniversities_blankKeyword() throws Exception {
        mockMvc.perform(get("/api/v1/universities")
                        .param("keyword", "   "))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("학교 ID로 학과 목록을 조회하면 200과 학과 목록을 반환한다")
    void getDepartments() throws Exception {
        given(universityQueryService.getDepartments(12L))
                .willReturn(List.of(
                        new DepartmentResponse(301L, "경영학과"),
                        new DepartmentResponse(302L, "컴퓨터공학과")
                ));

        mockMvc.perform(get("/api/v1/universities/12/departments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(301))
                .andExpect(jsonPath("$.data[0].name").value("경영학과"))
                .andExpect(jsonPath("$.data[1].id").value(302))
                .andExpect(jsonPath("$.data[1].name").value("컴퓨터공학과"));

        verify(universityQueryService).getDepartments(12L);
    }

    @Test
    @DisplayName("존재하지 않는 학교의 학과를 조회하면 404를 반환한다")
    void getDepartments_universityNotFound() throws Exception {
        given(universityQueryService.getDepartments(999999L))
                .willThrow(new BusinessException(ErrorCode.UNIV_NOT_FOUND));

        mockMvc.perform(get("/api/v1/universities/999999/departments"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("UNIV_NOT_FOUND"));

        verify(universityQueryService).getDepartments(999999L);
    }
}
