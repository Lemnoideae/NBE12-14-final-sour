package com.back.nbe1214finalsour.domain.contribution;

import java.util.OptionalLong;

public interface ContributionWallet {

    // 잔액이 충분하면 차감하고 남은 잔액을 반환, 부족하면 차감하지 않고 empty 반환
    OptionalLong tryDeduct(Long userId, Long universityId, long amount);

    // 이미 차감한 기여도를 되돌림
    void restore(Long userId, Long universityId, long amount);

    // 회원의 현재 기여도 (교내 개인 순위 ZSET의 점수, 없으면 0)
    long findBalance(Long userId, Long universityId);
}
