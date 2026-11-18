package com.back.nbe1214finalsour.domain.clicker.service;

import com.back.nbe1214finalsour.domain.clicker.repository.UserClickerLevelStore;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ClickerLevelUpdater {

    private final UserClickerLevelStore userClickerLevelStore;

    // 트랜잭션 경계를 이 빈으로 분리: COMMIT이 메서드 반환 시점에 끝나므로 호출자의 try/catch가 COMMIT 실패도 잡는다
    @Transactional
    public void changeLevel(Long userId, long currentLevel, long nextLevel) {
        // 현재 레벨일 때만 변경(조건부 UPDATE). 0건이면 다른 요청이 먼저 레벨을 바꾼 것
        boolean changed = this.userClickerLevelStore.changeLevel(userId, currentLevel, nextLevel);
        if (!changed) {
            throw new BusinessException(ErrorCode.CLICKER_UPGRADE_CONFLICT);
        }
    }
}
