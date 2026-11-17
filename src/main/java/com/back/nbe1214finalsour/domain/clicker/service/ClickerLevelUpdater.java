package com.back.nbe1214finalsour.domain.clicker.service;

import com.back.nbe1214finalsour.domain.clicker.repository.UserClickerLevelStore;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class ClickerLevelUpdater {

    private final UserClickerLevelStore userClickerLevelStore;

    public void changeLevel(Long userId, long currentLevel, long nextLevel) {
    }
}
