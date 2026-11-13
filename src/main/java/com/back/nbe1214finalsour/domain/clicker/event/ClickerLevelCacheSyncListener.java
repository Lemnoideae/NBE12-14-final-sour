package com.back.nbe1214finalsour.domain.clicker.event;

import com.back.nbe1214finalsour.domain.clicker.repository.UserClickerLevelCache;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

// 업그레이드가 DB에 커밋된 뒤 클릭 엔진용 Redis 레벨 캐시를 맞춘다
@Slf4j
@Component
@RequiredArgsConstructor
public class ClickerLevelCacheSyncListener {

    private final UserClickerLevelCache userClickerLevelCache;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onClickerUpgraded(ClickerUpgradedEvent event) {
        try {
            userClickerLevelCache.raiseLevel(event.userId(), event.newLevel());
        } catch (RuntimeException e) {
            // 업그레이드는 이미 커밋됐으므로 요청을 실패로 만들지 않는다. 캐시가 옛 레벨로 남으므로 로그로 감지한다
            log.error("클리커 레벨 캐시 갱신 실패 userId={}, newLevel={}", event.userId(), event.newLevel(), e);
        }
    }
}
