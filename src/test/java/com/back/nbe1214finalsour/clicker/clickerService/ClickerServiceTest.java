package com.back.nbe1214finalsour.clicker.clickerService;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
public class ClickerServiceTest {

    @Mock
    private ClickerRepository clickerRepository;

    @InjectMocks
    private ClickerService clickerService;

    // 서비스가 Repository 조회 결과를 그대로 반환하는지 검증
    @Test
    @DisplayName("클리커 레벨표를 조회해 반환")
    void getLevelTable() {
        // given: DB에 레벨 1, 2가 저장되어 있다고 가정
        given(clickerRepository.findAllByOrderByIdAsc()).willReturn(
                List.of(
                        Clicker.create(1L, 10, 0L),
                        Clicker.create(2L, 20, 300L)
                )
        );

        // when
        List<Clicker> result = clickerService.getLevelTable();

        // then: Repository가 준 순서와 값 그대로 반환
        assertThat(result).extracting(Clicker::getId, Clicker::getClickPower, Clicker::getRequiredScore)
                .containsExactly(
                        tuple(1L, 10, 0L),
                        tuple(2L, 20, 300L)
                );


    }



}
