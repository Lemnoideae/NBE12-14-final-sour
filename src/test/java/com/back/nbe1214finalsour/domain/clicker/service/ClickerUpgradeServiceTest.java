package com.back.nbe1214finalsour.domain.clicker.service;

import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import com.back.nbe1214finalsour.domain.clicker.event.ClickerUpgradedEvent;
import com.back.nbe1214finalsour.domain.clicker.repository.UserClickerLevelCache;
import com.back.nbe1214finalsour.domain.clicker.repository.UserClickerLevelStore;
import com.back.nbe1214finalsour.domain.contribution.ContributionWallet;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataAccessResourceFailureException;

import java.util.List;
import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;

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

    // 아직 서비스가 쓰지 않는다 (4단계 이후 사용)
    @Mock
    private ClickerLevelUpdater clickerLevelUpdater;

    @Mock
    private UserClickerLevelCache userClickerLevelCache;

    @InjectMocks
    private ClickerUpgradeService clickerUpgradeService;

    @Nested
    @DisplayName("이미 최고 레벨일 때")
    class WhenMaxLevel {

        @Test
        @DisplayName("업그레이드하면 CLICKER_MAX_LEVEL 예외가 나고, 차감·레벨 변경·캐시 갱신·복구는 하지 않는다")
        void upgrade_maxLevel() {
            // given: 레벨표는 3레벨이 최고 레벨, 유저는 이미 3레벨
            given(clickerService.getLevelTable()).willReturn(LEVEL_TABLE);
            given(userClickerLevelStore.findLevel(USER_ID)).willReturn(3L);

            // when
            Throwable thrown = catchThrowable(
                    () -> clickerUpgradeService.upgrade(USER_ID, UNIVERSITY_ID));

            // then
            assertThat(thrown)
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.CLICKER_MAX_LEVEL);

            then(contributionWallet).should(never()).tryDeduct(anyLong(), anyLong(), anyLong());
            then(clickerLevelUpdater).should(never()).changeLevel(anyLong(), anyLong(), anyLong());
            then(userClickerLevelCache).should(never()).raiseLevel(anyLong(), anyLong());
            then(contributionWallet).should(never()).restore(anyLong(), anyLong(), anyLong());
        }
    }

    @Nested
    @DisplayName("기여도가 부족할 때")
    class WhenNotEnoughScore {

        @Test
        @DisplayName("업그레이드하면 CLICKER_NOT_ENOUGH_SCORE 예외가 나고, 레벨 변경·캐시 갱신·복구는 하지 않는다")
        void upgrade_notEnoughScore() {
            // given: 유저는 1레벨, 다음 레벨(2) 비용은 300인데 잔액 부족
            given(clickerService.getLevelTable()).willReturn(LEVEL_TABLE);
            given(userClickerLevelStore.findLevel(USER_ID)).willReturn(1L);
            given(contributionWallet.tryDeduct(USER_ID, UNIVERSITY_ID, 300L)).willReturn(OptionalLong.empty());

            // when
            Throwable thrown = catchThrowable(
                    () -> clickerUpgradeService.upgrade(USER_ID, UNIVERSITY_ID));

            // then
            assertThat(thrown)
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.CLICKER_NOT_ENOUGH_SCORE);

            then(clickerLevelUpdater).should(never()).changeLevel(anyLong(), anyLong(), anyLong());
            then(userClickerLevelCache).should(never()).raiseLevel(anyLong(), anyLong());
            then(contributionWallet).should(never()).restore(anyLong(), anyLong(), anyLong());
        }
    }

    @Nested
    @DisplayName("업그레이드에 성공할 때")
    class WhenSuccess {

        @Test
        @DisplayName("업그레이드하면 다음 레벨 비용만큼 차감하고 레벨을 1 올린 결과를 반환한다")
        void upgrade_success() {
            // given
            given(clickerService.getLevelTable()).willReturn(LEVEL_TABLE);
            given(userClickerLevelStore.findLevel(USER_ID)).willReturn(1L);
            given(contributionWallet.tryDeduct(USER_ID, UNIVERSITY_ID, 300L)).willReturn(OptionalLong.of(700L));

            // when
            ClickerUpgradeResult result = clickerUpgradeService.upgrade(USER_ID, UNIVERSITY_ID);

            // then
            assertThat(result.upgradedClicker().getId()).isEqualTo(2L);
            assertThat(result.upgradedClicker().getClickPower()).isEqualTo(20);
            assertThat(result.nextLevelRequiredScore()).isEqualTo(1000L);
            assertThat(result.remainingScore()).isEqualTo(700L);

            then(eventPublisher).should().publishEvent(new ClickerUpgradedEvent(USER_ID, 2L));
            then(clickerLevelUpdater).should().changeLevel(USER_ID, 1L, 2L);
            then(contributionWallet).should(never()).restore(anyLong(), anyLong(), anyLong());
        }
    }

    @Nested
    @DisplayName("레벨 변경 중 DB 예외가 날 때")
    class WhenDbFailure {

        @Test
        @DisplayName("업그레이드하면 차감한 기여도를 복구하고 같은 예외를 던진다")
        void upgrade_dbFailure() {
            // given: 300 차감에 성공했지만 레벨 변경 중 DB 연결 장애
            given(clickerService.getLevelTable()).willReturn(LEVEL_TABLE);
            given(userClickerLevelStore.findLevel(USER_ID)).willReturn(1L);
            given(contributionWallet.tryDeduct(USER_ID, UNIVERSITY_ID, 300L)).willReturn(OptionalLong.of(700L));
            DataAccessResourceFailureException dbFailure = new DataAccessResourceFailureException("DB 연결 실패");
            willThrow(dbFailure).given(clickerLevelUpdater).changeLevel(USER_ID, 1L, 2L);

            // when
            Throwable thrown = catchThrowable(
                    () -> clickerUpgradeService.upgrade(USER_ID, UNIVERSITY_ID));

            // then
            assertThat(thrown).isSameAs(dbFailure);

            then(contributionWallet).should().restore(USER_ID, UNIVERSITY_ID, 300L);
            then(userClickerLevelCache).should(never()).raiseLevel(anyLong(), anyLong());
        }
    }

    @Nested
    @DisplayName("레벨 변경이 충돌로 실패할 때")
    class WhenConflict {

        @Test
        @DisplayName("업그레이드하면 차감한 기여도를 복구하고 CLICKER_UPGRADE_CONFLICT 예외가 난다")
        void upgrade_conflict() {
            // given: 1레벨 유저가 300 차감에 성공했지만 이미 다른 요청이 레벨을 올려서 변경 실패
            given(clickerService.getLevelTable()).willReturn(LEVEL_TABLE);
            given(userClickerLevelStore.findLevel(USER_ID)).willReturn(1L);
            given(contributionWallet.tryDeduct(USER_ID, UNIVERSITY_ID, 300L)).willReturn(OptionalLong.of(700L));
            BusinessException conflict = new BusinessException(ErrorCode.CLICKER_UPGRADE_CONFLICT);
            willThrow(conflict).given(clickerLevelUpdater).changeLevel(USER_ID, 1L, 2L);

            // when
            Throwable thrown = catchThrowable(
                    () -> clickerUpgradeService.upgrade(USER_ID, UNIVERSITY_ID));

            // then
            assertThat(thrown).isSameAs(conflict);

            then(clickerLevelUpdater).should().changeLevel(USER_ID, 1L, 2L);
            then(contributionWallet).should().restore(USER_ID, UNIVERSITY_ID, 300L);
            then(userClickerLevelCache).should(never()).raiseLevel(anyLong(), anyLong());
            then(eventPublisher).should(never()).publishEvent(any(ClickerUpgradedEvent.class));
        }
    }
}
