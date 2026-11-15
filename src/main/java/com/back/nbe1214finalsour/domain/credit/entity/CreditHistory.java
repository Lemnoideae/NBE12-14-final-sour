package com.back.nbe1214finalsour.domain.credit.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.OffsetDateTime;

@Entity
@Table(name = "credit_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CreditHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    // 충전(CHARGE)일 때만 있음
    @Column(name = "payment_id")
    private Long paymentId;

    // 사용(USE)일 때만 있음
    @Column(name = "user_item_id")
    private Long userItemId;

    // 증감량 (항상 양수, 방향은 type으로 구분)
    @Column(nullable = false)
    private long amount;

    // 이 행을 반영한 뒤의 users.credit_balance
    @Column(name = "balance_after", nullable = false)
    private long balanceAfter;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CreditHistoryType type;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    // 아이템 구매로 크레딧을 쓴 기록
    public static CreditHistory use(Long userId, Long userItemId, long amount, long balanceAfter) {
        CreditHistory history = new CreditHistory();
        history.userId = userId;
        history.userItemId = userItemId;
        history.amount = amount;
        history.balanceAfter = balanceAfter;
        history.type = CreditHistoryType.USE;
        return history;
    }
}