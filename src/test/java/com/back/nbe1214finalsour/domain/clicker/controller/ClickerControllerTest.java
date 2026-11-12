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
@AutoConfigureMockMvc(addFilters = false) // Security 설정이 생기기 전까지 필터 제외
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
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].level").value(1))
                .andExpect(jsonPath("$[0].clickPower").value(10))
                .andExpect(jsonPath("$[0].requiredScore").value(0))
                .andExpect(jsonPath("$[1].level").value(2))
                .andExpect(jsonPath("$[1].clickPower").value(20))
                .andExpect(jsonPath("$[1].requiredScore").value(300));
    }
}
