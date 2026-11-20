package com.back.nbe1214finalsour.domain.item.service;

import com.back.nbe1214finalsour.domain.contribution.ContributionWallet;
import com.back.nbe1214finalsour.domain.credit.repository.CreditWallet;
import com.back.nbe1214finalsour.domain.item.entity.Item;
import com.back.nbe1214finalsour.domain.item.event.PotionPurchasedEvent;
import com.back.nbe1214finalsour.domain.userItem.entity.UserItem;
import com.back.nbe1214finalsour.domain.userItem.repository.UserItemRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;

// 기여도 아이템(물약) 구매
// 트랜잭션이 있어야 PotionPurchasedEvent가 커밋 후(AFTER_COMMIT) 리스너로 전달된다
@Service
@RequiredArgsConstructor
public class ContributionPurchaseService {

    private final ContributionWallet contributionWallet;
    private final CreditWallet creditWallet;
    private final UserItemRepository userItemRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;

    @Transactional
    public ItemPurchaseResult purchase(Long userId, Long universityId, Item item, UUID idempotencyKey) {
        // Redis의 기여도 차감 시도
        long myContribScore = this.contributionWallet.tryDeduct(userId, universityId, item.getPrice())
                .orElseThrow(() -> new BusinessException(ErrorCode.ITEM_NOT_ENOUGH_SCORE)); // 잔여 기여도가 부족하다면 차감없이 400

        // 구매 이력 저장
        UserItem userItem = UserItem.ofPotion(userId, item, OffsetDateTime.now(this.clock));
        try {
            this.userItemRepository.save(userItem);
        } catch (RuntimeException e) {
            // Redis 차감은 DB 롤백으로 돌아오지 않으므로 직접 되돌린 뒤 원래 예외를 그대로 던진다
            this.contributionWallet.restore(userId, universityId, item.getPrice());
            throw e;
        }

        // Redis user:{userId}:effect에 효과 적용 (커밋 후 리스너가 처리)
        this.eventPublisher.publishEvent(
                new PotionPurchasedEvent(userId, item.getId(), item.getMultiplier(), userItem.getExpiredAt()));

        // 기여도 아이템이라 크레딧은 차감되지 않은 현재 값
        return new ItemPurchaseResult(
                userItem.getId(),
                item,
                userItem.getPrice(),
                userItem.getExpiredAt(),
                myContribScore,
                this.creditWallet.findBalance(userId)
        );
    }
}