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

        // 유저의 현재 레벨+1의 레벨이 레벨표에 존재하는 지 확인 후 해당 클리커 반환
        Clicker nextClicker = levelTable.stream()
                .filter(clicker -> clicker.getId() == currentLevel + 1)
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.CLICKER_MAX_LEVEL)); // 없으면 이미 최고 레벨

        // 유저에게 업그레이드에 필요한 충분한 기여도가 있는 지 확인 후 차감
        long remainingScore = this.contributionWallet.tryDeduct(userId, nextClicker.getRequiredScore())
                .orElseThrow(() -> new BusinessException(ErrorCode.CLICKER_NOT_ENOUGH_SCORE));  // 잔액이 부족하면 차감하지 않고 예외
    }
}
