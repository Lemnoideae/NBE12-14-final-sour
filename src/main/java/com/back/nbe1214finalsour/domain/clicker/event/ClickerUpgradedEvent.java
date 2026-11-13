package com.back.nbe1214finalsour.domain.clicker.event;

// 클리커 업그레이드가 DB에 반영됨. 커밋 후 클릭 엔진용 Redis 레벨 캐시를 맞추는 데 쓴다
public record ClickerUpgradedEvent(Long userId, long newLevel) {
}
