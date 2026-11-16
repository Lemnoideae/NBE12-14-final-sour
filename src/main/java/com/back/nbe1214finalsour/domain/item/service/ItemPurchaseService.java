package com.back.nbe1214finalsour.domain.item.service;

import com.back.nbe1214finalsour.domain.item.entity.Item;
import com.back.nbe1214finalsour.domain.item.entity.PayType;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

// 아이템 구매 진입점: 아이템을 찾고 결제 수단에 맞는 서비스로 위임
@Service
@RequiredArgsConstructor
public class ItemPurchaseService {

    private final ItemService itemService;
    private final CreditPurchaseService creditPurchaseService;
    private final ContributionPurchaseService contributionPurchaseService;

    // 아이템 구매
    public ItemPurchaseResult purchase(Long userId, Long universityId, Long departmentId, Long itemId, String logoImageUrl) {

        // 캐시에서 아이템 목록
        List<Item> items = this.itemService.getItems();

        // 목록에 해당 Id의 아이템이 있는 지 확인 후 반환
        Item item = items.stream()
                .filter(itemInService -> itemInService.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.ITEM_NOT_FOUND));    // 아이템이 리스트에 없으면 404

        // 크레딧 아이템(로고 변경권)
        if (item.getPayType() == PayType.CREDIT) {
            return this.creditPurchaseService.purchase(userId, universityId, departmentId, item, logoImageUrl);
        }

        // 기여도 아이템(물약)
        return this.contributionPurchaseService.purchase(userId, universityId, item);
    }
}