package com.back.nbe1214finalsour.domain.item.service;

import com.back.nbe1214finalsour.domain.item.entity.Item;
import com.back.nbe1214finalsour.domain.item.entity.ItemType;
import com.back.nbe1214finalsour.domain.item.entity.PayType;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
public class ItemPurchaseServiceTest {

    @Mock
    private ItemService itemService;

    @Mock
    private CreditPurchaseService creditPurchaseService;

    @Mock
    private ContributionPurchaseService contributionPurchaseService;

    @InjectMocks
    private ItemPurchaseService itemPurchaseService;

    private static final Long USER_ID = 1L;
    private static final Long UNIVERSITY_ID = 12L;
    private static final Long DEPARTMENT_ID = 34L;
    private static final String LOGO_URL = "https://cdn.devcproject.cloud/custom-logo/1/abc.png";

    private static final List<Item> ITEMS = List.of(
            new Item(1L, "2배 물약", "1시간 동안 클릭 점수 2배", ItemType.MULTIPLIER, PayType.CONTRIBUTION, 500L, 3600, 2.0),
            new Item(2L, "4배 물약", "1시간 동안 클릭 점수 4배", ItemType.MULTIPLIER, PayType.CONTRIBUTION, 1000L, 3600, 4.0),
            new Item(3L, "학교 로고 변경권", "우리 학교 로고 변경", ItemType.LOGO_UNIVERSITY, PayType.CREDIT, 3900L, null, null),
            new Item(4L, "학과 로고 변경권", "우리 학과 로고 변경", ItemType.LOGO_DEPARTMENT, PayType.CREDIT, 2900L, null, null),
            new Item(5L, "개인 로고 변경권", "내 프로필 로고 변경", ItemType.LOGO_PROFILE, PayType.CREDIT, 1900L, null, null)
    );

    @Test
    @DisplayName("존재하지 않는 아이템을 사면 ITEM_NOT_FOUND, 어느 결제 서비스도 호출하지 않는다")
    void purchase_itemNotFound() {
        given(this.itemService.getItems())
                .willReturn(ITEMS);

        assertThatThrownBy(() -> this.itemPurchaseService.purchase(USER_ID, UNIVERSITY_ID, null, 3980L, null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.ITEM_NOT_FOUND);

        verifyNoInteractions(this.creditPurchaseService, this.contributionPurchaseService);
    }

    @Test
    @DisplayName("크레딧 아이템이면 CreditPurchaseService에 위임하고, 기여도 구매는 호출하지 않는다")
    void purchase_creditItem_delegatesToCreditPurchaseService() {
        given(this.itemService.getItems())
                .willReturn(ITEMS);
        ItemPurchaseResult expected = new ItemPurchaseResult(7001L, ITEMS.get(2), 3900L, null, 12888L, 1100L);
        given(this.creditPurchaseService.purchase(USER_ID, UNIVERSITY_ID, DEPARTMENT_ID, ITEMS.get(2), LOGO_URL))
                .willReturn(expected);

        ItemPurchaseResult result = this.itemPurchaseService.purchase(USER_ID, UNIVERSITY_ID, DEPARTMENT_ID, 3L, LOGO_URL);

        assertThat(result).isSameAs(expected);
        verifyNoInteractions(this.contributionPurchaseService);
    }

    @Test
    @DisplayName("기여도 아이템이면 ContributionPurchaseService에 위임하고, 크레딧 구매는 호출하지 않는다")
    void purchase_contributionItem_delegatesToContributionPurchaseService() {
        given(this.itemService.getItems())
                .willReturn(ITEMS);
        ItemPurchaseResult expected = new ItemPurchaseResult(5530L, ITEMS.get(1), 1000L, null, 1500L, 1100L);
        given(this.contributionPurchaseService.purchase(USER_ID, UNIVERSITY_ID, ITEMS.get(1)))
                .willReturn(expected);

        ItemPurchaseResult result = this.itemPurchaseService.purchase(USER_ID, UNIVERSITY_ID, null, 2L, null);

        assertThat(result).isSameAs(expected);
        verifyNoInteractions(this.creditPurchaseService);
    }
}