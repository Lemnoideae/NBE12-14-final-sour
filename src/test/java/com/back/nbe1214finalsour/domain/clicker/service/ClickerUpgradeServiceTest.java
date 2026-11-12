package com.back.nbe1214finalsour.domain.clicker.service;

import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class ClickerUpgradeServiceTest {

    private static final Long USER_ID = 1L;

    @Mock
    private ClickerService clickerService;

    @Mock
    private UserClickerLevelStore userClickerLevelStore;

    @Mock
    private ContributionWallet contributionWallet;

    @InjectMocks
    private ClickerUpgradeService clickerUpgradeService;

    @Test
    @DisplayName("이미 최고 레벨이면 CLICKER_MAX_LEVEL 예외, 기여도 차감과 레벨 변경은 하지 않음")
    void upgrade_maxLevel(){
        // given: 레벨표는 1~2레벨, 유저는 이미 2레벨
        given(clickerService.getLevelTable()).willReturn(List.of(
                new Clicker(1L, 10, 0L),
                new Clicker(2L, 20, 300L)
        ));
        given(userClickerLevelStore.findLevel(USER_ID)).willReturn(2L);

        // when & then
        assertThatThrownBy(() -> clickerUpgradeService.upgrade(USER_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CLICKER_MAX_LEVEL);

        verify(contributionWallet, never()).tryDeduct(anyLong(), anyLong());
        verify(userClickerLevelStore, never()).changeLevel(anyLong(), anyLong(), anyLong());
    }

}
