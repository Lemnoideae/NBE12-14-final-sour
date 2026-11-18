package com.back.nbe1214finalsour.domain.clicker.service;

import com.back.nbe1214finalsour.domain.clicker.repository.UserClickerLevelStore;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class)
class ClickerLevelUpdaterTest {

    private static final Long USER_ID = 1L;

    @Mock
    private UserClickerLevelStore userClickerLevelStore;

    @InjectMocks
    private ClickerLevelUpdater clickerLevelUpdater;

    @Nested
    @DisplayName("레벨을 변경할 때")
    class ChangeLevel {

        @Test
        @DisplayName("조건부 UPDATE가 1건 반영되면 예외 없이 끝난다")
        void changeLevel_success() {
            // given
            given(userClickerLevelStore.changeLevel(USER_ID, 1L, 2L)).willReturn(true);

            // when
            Runnable when = () -> clickerLevelUpdater.changeLevel(USER_ID, 1L, 2L);

            // then
            assertThatCode(when::run).doesNotThrowAnyException();
            then(userClickerLevelStore).should().changeLevel(USER_ID, 1L, 2L);
        }

        @Test
        @DisplayName("조건부 UPDATE가 0건이면 CLICKER_UPGRADE_CONFLICT 예외를 던진다")
        void changeLevel_conflict() {
            // given
            given(userClickerLevelStore.changeLevel(USER_ID, 1L, 2L)).willReturn(false);

            // when & then
            assertThatThrownBy(() -> clickerLevelUpdater.changeLevel(USER_ID, 1L, 2L))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.CLICKER_UPGRADE_CONFLICT);
        }
    }
}
