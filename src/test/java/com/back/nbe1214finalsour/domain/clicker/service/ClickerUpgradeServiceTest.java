package com.back.nbe1214finalsour.domain.clicker.service;

import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import com.back.nbe1214finalsour.domain.clicker.repository.UserClickerLevelStore;
import com.back.nbe1214finalsour.domain.contribution.ContributionWallet;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;


import static org.mockito.ArgumentMatchers.any;

import java.util.List;
import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class ClickerUpgradeServiceTest {

    private static final Long USER_ID = 1L;
    private static final Long UNIVERSITY_ID = 12L;

    // 레벨표: 1레벨(기본) → 2레벨(300) → 3레벨(1000)
    private static final List<Clicker> LEVEL_TABLE = List.of(
            new Clicker(1L, 10, 0L),
            new Clicker(2L, 20, 300L),
            new Clicker(3L, 40, 1000L)
    );

    @Mock
    private ClickerService clickerService;

    @Mock
    private UserClickerLevelStore userClickerLevelStore;

    @Mock
    private ContributionWallet contributionWallet;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private ClickerUpgradeService clickerUpgradeService;

    @Test
    @DisplayName("이미 최고 레벨이면 CLICKER_MAX_LEVEL 예외, 기여도 차감과 레벨 변경은 하지 않음")
    void upgrade_maxLevel(){
        // given: 레벨표는 3레벨 최고 레벨, 유저는 이미 3레벨
        given(clickerService.getLevelTable()).willReturn(LEVEL_TABLE);
        given(userClickerLevelStore.findLevel(USER_ID)).willReturn(3L);

        // when & then
        assertThatThrownBy(() -> clickerUpgradeService.upgrade(USER_ID, UNIVERSITY_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CLICKER_MAX_LEVEL);

        verify(eventPublisher, never()).publishEvent(any(ClickerUpgradedEvent.class));
        verify(contributionWallet, never()).tryDeduct(anyLong(), anyLong(), anyLong());
        verify(userClickerLevelStore, never()).changeLevel(anyLong(), anyLong(), anyLong());
    }

    @Test
    @DisplayName("기여도가 부족하면 CLICKER_NOT_ENOUGH_SCORE 예외, 레벨 변경과 기여도 복구는 하지 않음")
    void upgrade_notEnoughScore() {
        // given: 유저는 1레벨, 다음 레벨(2) 비용은 300인데 잔액 부족
        given(clickerService.getLevelTable()).willReturn(LEVEL_TABLE);
        given(userClickerLevelStore.findLevel(USER_ID)).willReturn(1L);
        given(contributionWallet.tryDeduct(USER_ID, UNIVERSITY_ID, 300L)).willReturn(OptionalLong.empty());

        // when & then
        assertThatThrownBy(() -> clickerUpgradeService.upgrade(USER_ID, UNIVERSITY_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CLICKER_NOT_ENOUGH_SCORE);

        verify(eventPublisher, never()).publishEvent(any(ClickerUpgradedEvent.class));
        verify(userClickerLevelStore, never()).changeLevel(anyLong(), anyLong(), anyLong());
        verify(contributionWallet, never()).restore(anyLong(), anyLong(), anyLong());
    }

    @Test
    @DisplayName("업그레이드 성공 시 다음 레벨 비용만큼 차감하고 레벨을 1 올린 결과를 반환")
    void upgrade_success() {
        // given
        given(clickerService.getLevelTable()).willReturn(LEVEL_TABLE);
        given(userClickerLevelStore.findLevel(USER_ID)).willReturn(1L);
        given(contributionWallet.tryDeduct(USER_ID, UNIVERSITY_ID, 300L)).willReturn(OptionalLong.of(700L));
        given(userClickerLevelStore.changeLevel(USER_ID, 1L, 2L)).willReturn(true);

        // when
        ClickerUpgradeResult result = this.clickerUpgradeService.upgrade(USER_ID, UNIVERSITY_ID);

        // then
        assertThat(result.upgradedClicker().getId()).isEqualTo(2L);
        assertThat(result.upgradedClicker().getClickPower()).isEqualTo(20);
        assertThat(result.nextLevelRequiredScore()).isEqualTo(1000L);
        assertThat(result.remainingScore()).isEqualTo(700L);

        verify(eventPublisher).publishEvent(new ClickerUpgradedEvent(USER_ID, 2L));
        verify(userClickerLevelStore).changeLevel(USER_ID, 1L, 2L);
        verify(contributionWallet, never()).restore(anyLong(), anyLong(), anyLong());
    }

    @Test
    @DisplayName("레벨 변경이 충돌로 실패 시 차감한 기여도 복구 후 CLICKER_UPGRADE_CONFLICT 예외")
    void upgrade_conflict() {
        // given: 1 레벨 유저가 300 차감 성공이지만 이미 다른 요청이 레벨을 올렸을 시 변경 실패
        given(clickerService.getLevelTable()).willReturn(LEVEL_TABLE);
        given(userClickerLevelStore.findLevel(USER_ID)).willReturn(1L);
        given(contributionWallet.tryDeduct(USER_ID, UNIVERSITY_ID, 300L)).willReturn(OptionalLong.of(700L));
        given(userClickerLevelStore.changeLevel(USER_ID, 1L, 2L)).willReturn(false);

        // when & then
        assertThatThrownBy(() -> clickerUpgradeService.upgrade(USER_ID, UNIVERSITY_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CLICKER_UPGRADE_CONFLICT);

        verify(eventPublisher, never()).publishEvent(any(ClickerUpgradedEvent.class));
        verify(contributionWallet).restore(USER_ID, UNIVERSITY_ID, 300L);
    }
}
