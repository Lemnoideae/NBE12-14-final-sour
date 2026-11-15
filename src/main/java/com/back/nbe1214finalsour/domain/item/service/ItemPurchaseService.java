package com.back.nbe1214finalsour.domain.item.service;

import com.back.nbe1214finalsour.domain.contribution.ContributionWallet;
import com.back.nbe1214finalsour.domain.credit.entity.CreditHistory;
import com.back.nbe1214finalsour.domain.credit.repository.CreditHistoryRepository;
import com.back.nbe1214finalsour.domain.credit.repository.CreditWallet;
import com.back.nbe1214finalsour.domain.item.entity.Item;
import com.back.nbe1214finalsour.domain.item.entity.PayType;
import com.back.nbe1214finalsour.domain.item.event.PotionPurchasedEvent;
import com.back.nbe1214finalsour.domain.university.repository.DepartmentRepository;
import com.back.nbe1214finalsour.domain.university.repository.UniversityRepository;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
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
import java.util.List;

@Service
@RequiredArgsConstructor
public class ItemPurchaseService {

    private final ItemService itemService;
    private final ContributionWallet contributionWallet;
    private final CreditWallet creditWallet;
    private final UserItemRepository userItemRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final CreditHistoryRepository creditHistoryRepository;
    private final UniversityRepository universityRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;

    private final Clock clock;


    // 아이템 구매
    @Transactional
    public ItemPurchaseResult purchase(Long userId, Long universityId, Long departmentId, Long itemId, String logoImageUrl) {

        // 캐시에서 아이템 목록
        List<Item> items = this.itemService.getItems();

        // 목록에 해당 Id의 아이템이 있는 지 확인 후 반환
        Item item = items.stream()
                .filter(itemInService -> itemInService.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.ITEM_NOT_FOUND));    // 아이템이 리스트에 없으면 404

        // 크레딧 아이템 (로고 변경권). DB 한 트랜잭션이라 중간에 실패하면 크레딧 차감까지 함께 롤백된다
        if (item.getPayType() == PayType.CREDIT) {
            if (logoImageUrl == null || logoImageUrl.isBlank()) {
                throw new BusinessException(ErrorCode.ITEM_LOGO_IMAGE_REQUIRED);
            }

            // 크레딧 차감 (조건부 UPDATE), 성공하면 차감 후 잔액
            long myCreditBalance = this.creditWallet.tryDeduct(userId, item.getPrice())
                    .orElseThrow(() -> new BusinessException(ErrorCode.ITEM_NOT_ENOUGH_CREDIT));

            // 구매 이력 저장 (IDENTITY라 저장 후 같은 객체에 id가 채워짐)
            UserItem userItem = UserItem.ofLogo(userId, item, logoImageUrl);
            this.userItemRepository.save(userItem);

            // 크레딧 사용 내역 저장 (구매 이력과 연결)
            this.creditHistoryRepository.save(
                    CreditHistory.use(userId, userItem.getId(), item.getPrice(), myCreditBalance));

            // 로고 적용: 아이템 종류에 따라 학교·학과·개인 로고를 덮어씀 (마지막 구매 기준, 커밋 시 변경 감지로 UPDATE)
            switch (item.getType()) {
                case LOGO_UNIVERSITY -> this.universityRepository.findById(universityId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.UNIV_NOT_FOUND))
                        .changeLogoUrl(logoImageUrl);
                case LOGO_DEPARTMENT -> this.departmentRepository.findById(departmentId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.UNIV_DEPARTMENT_NOT_FOUND))
                        .changeLogoUrl(logoImageUrl);
                case LOGO_PROFILE -> this.userRepository.findById(userId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND))
                        .changeProfileImageUrl(logoImageUrl);
                default -> throw new IllegalStateException("크레딧 아이템이 로고가 아님: " + item.getType());
            }

            // 크레딧 아이템이라 기여도는 차감되지 않은 현재 값
            return new ItemPurchaseResult(
                    userItem.getId(),
                    item,
                    userItem.getPrice(),
                    userItem.getExpiredAt(),
                    this.contributionWallet.findBalance(userId, universityId),
                    myCreditBalance
            );
        }

        // 기여도 아이템일 때
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

        // Redis user:{userId}:effect에 효과 적용
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
