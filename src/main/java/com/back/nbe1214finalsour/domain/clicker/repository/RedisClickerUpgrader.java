package com.back.nbe1214finalsour.domain.clicker.repository;

import org.springframework.stereotype.Repository;

// 기대 레벨 비교 + 기여도 차감 + 레벨 +1 + dirty 표시를 Lua 한 번으로 처리
// 반환: >=0 잔액, -1 기여도 부족(기록 없음 포함), -2 레벨이 기대값과 다름(키 없음 포함)
@Repository
public class RedisClickerUpgrader {

    // 빈 껍데기 (10단계에서 구현)
    public long upgrade(Long userId, Long universityId, long expectedLevel, long cost) {
        return 0;
    }
}
