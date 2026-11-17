package com.back.nbe1214finalsour.domain.clicker.service;

import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import com.back.nbe1214finalsour.domain.clicker.repository.UserClickerLevelCache;
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
    private final ClickerLevelUpdater clickerLevelUpdater;
    private final UserClickerLevelCache userClickerLevelCache;

    public ClickerUpgradeResult upgrade(Long userId, Long universityId) {
        List<Clicker> levelTable = this.clickerService.getLevelTable();
        long currentLevel = this.userClickerLevelStore.findLevel(userId);

        // 유저의 현재 레벨+1의 레벨이 레벨표에 존재하는 지 확인 후 해당 클리커 반환
        Clicker nextClicker = levelTable.stream()
                .filter(clicker -> clicker.getId() == currentLevel + 1)
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.CLICKER_MAX_LEVEL)); // 없으면 이미 최고 레벨

        // 유저에게 업그레이드에 필요한 충분한 기여도가 있는 지 확인 후 차감, 차감 성공 시 남은 잔여 기여도 반환
        long remainingScore = this.contributionWallet.tryDeduct(userId, universityId, nextClicker.getRequiredScore())
                .orElseThrow(() -> new BusinessException(ErrorCode.CLICKER_NOT_ENOUGH_SCORE));  // 잔액이 부족하면 차감하지 않고 예외

        // 현재 레벨일 때만 다음 레벨로 변경 (조건부 UPDATE). 다른 요청이 먼저 레벨을 바꿨다면 updater가 충돌 예외를 던진다
        try {
            this.clickerLevelUpdater.changeLevel(userId, currentLevel, currentLevel + 1);
        } catch (RuntimeException e) {
            // 충돌·DB 예외 등 어떤 실패든 이 요청에서 차감한 기여도를 되돌린 뒤 원래 예외를 그대로 던진다
            this.contributionWallet.restore(userId, universityId, nextClicker.getRequiredScore());
            throw e;
        }

        // updater의 트랜잭션이 이미 커밋된 뒤이므로, 클릭 엔진용 레벨 캐시를 직접 갱신한다
        this.userClickerLevelCache.raiseLevel(userId, nextClicker.getId());

        // 다음 레벨업에 필요한 기여도 계산, 이번 레벨업 결과가 최고 레벨이라면 null
        Long nextLevelRequiredScore = levelTable.stream()
                .filter(clicker -> clicker.getId() == currentLevel + 2)
                .findFirst()
                .map(Clicker::getRequiredScore)
                .orElse(null);

        return new ClickerUpgradeResult(
                nextClicker,
                nextLevelRequiredScore,
                remainingScore
                );
    }
}
