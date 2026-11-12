package com.back.nbe1214finalsour.domain.clicker.repository;

import com.back.nbe1214finalsour.IntegrationTest;
import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
@Transactional
public class ClickerRepositoryTest {

    @Autowired
    private ClickerRepository clickerRepository;

    @Test
    @DisplayName("클리커 레벨표 조회시 레벨 기준 오름차순으로 조회")
    void findAllByOrderByIdAsc(){
        // given: V1에 있는 레벨 1 말고도 추가 레벨을 순서 없이 저장
        this.clickerRepository.saveAll(
                List.of(
                        new Clicker(3L, 30, 900L),
                        new Clicker(2L, 20, 300L)
                )
        );

        // when: 조회 시
        List<Clicker> result = this.clickerRepository.findAllByOrderByIdAsc();

        // then: 레벨 기준 오름차순 정렬
        assertThat(result).extracting(Clicker::getId)
                .containsExactly(1L, 2L, 3L);
    }
}
