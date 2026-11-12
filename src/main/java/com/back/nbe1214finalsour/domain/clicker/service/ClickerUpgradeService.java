package com.back.nbe1214finalsour.domain.clicker.service;

import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import com.back.nbe1214finalsour.domain.clicker.repository.UserClickerLevelStore;
import com.back.nbe1214finalsour.domain.contribution.ContributionWallet;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ClickerUpgradeService {

    private final ClickerService clickerService;
    private final UserClickerLevelStore userClickerLevelStore;
    private final ContributionWallet contributionWallet;

    public void upgrade(Long userId) {
        List<Clicker> levelTable = this.clickerService.getLevelTable();
        long currentLevel = this.userClickerLevelStore.findLevel(userId);

        Clicker nextClicker = levelTable.stream()
                .filter(clicker -> clicker.getId() == currentLevel + 1)
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.CLICKER_MAX_LEVEL));
    }
}
