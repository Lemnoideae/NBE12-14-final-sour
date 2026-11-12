package com.back.nbe1214finalsour.domain.clicker.controller;

import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import com.back.nbe1214finalsour.domain.clicker.service.ClickerService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;


@WebMvcTest(ClickerController.class)
@AutoConfigureMockMvc(addFilters = false) // 응답 형식만 검증. 인증·인가 규칙은 SecurityConfigTest에서 검증
public class ClickerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ClickerService clickerService;

    @Test
    @DisplayName("[GET] /api/v1/clickers는 레벨표를 200으로 응답")
    void getLevelTable() throws Exception {
        // given
        given(clickerService.getLevelTable()).willReturn(List.of(
                new Clicker(1L, 10, 0L),
                new Clicker(2L, 20, 300L)
        ));

        // when & then
        mockMvc.perform(get("/api/v1/clickers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.message").value("요청이 성공했습니다."))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].level").value(1))
                .andExpect(jsonPath("$.data[0].clickPower").value(10))
                .andExpect(jsonPath("$.data[0].requiredScore").value(0))
                .andExpect(jsonPath("$.data[1].level").value(2))
                .andExpect(jsonPath("$.data[1].clickPower").value(20))
                .andExpect(jsonPath("$.data[1].requiredScore").value(300));
    }
}
