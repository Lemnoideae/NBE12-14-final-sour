package com.back.nbe1214finalsour.domain.clicker.event;

import com.back.nbe1214finalsour.domain.clicker.repository.UserClickerLevelCache;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class ClickerLevelCacheSyncListenerTest {

    @Mock
    private UserClickerLevelCache userClickerLevelCache;

    @InjectMocks
    private ClickerLevelCacheSyncListener listener;

    @Test
    @DisplayName("업그레이드 이벤트를 받으면 회원 레벨 캐시를 새 레벨로 올림")
    void onClickerUpgraded() {
        listener.onClickerUpgraded(new ClickerUpgradedEvent(1L, 2L));

        verify(userClickerLevelCache).raiseLevel(1L, 2L);
    }
}
