package com.back.nbe1214finalsour.domain.clicker.repository;

public interface UserClickerLevelStore {

    // 유저의 현재 클리커 레벨
    long findLevel(Long userId);

    // 현재 레벨이 expectedLevel일 때만 newLevel로 변경. 변경했으면 true
    boolean changeLevel(Long userId, long expectedLevel, long newLevel);
}
