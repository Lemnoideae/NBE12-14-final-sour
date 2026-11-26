package com.back.nbe1214finalsour.domain.payment.service;

import com.back.nbe1214finalsour.domain.payment.entity.ChargeAmount;
import com.back.nbe1214finalsour.domain.payment.entity.Payment;
import com.back.nbe1214finalsour.domain.payment.repository.PaymentRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;

    // 충전 주문을 READY로 저장한다. 토스 호출은 없다 (프론트가 응답 값으로 결제창을 연다)
    @Transactional
    public Payment createOrder(Long userId, ChargeAmount chargeAmount) {
        return paymentRepository.save(Payment.ready(userId, chargeAmount));
    }

    // 결제창 실패를 기록한다. READY인 본인 주문만 ABORTED로 바뀐다 (조건은 abortIfReady 쿼리에 있다)
    // @Modifying 쿼리는 트랜잭션이 필요하다. 리포지토리가 열어 주지 않으므로 여기서 연다
    @Transactional
    public void recordFail(Long userId, String orderId, String code, String message) {
        int updated = paymentRepository.abortIfReady(orderId, userId, code, message);
        if (updated == 1) {
            return;
        }
        // 0행: 왜 안 바뀌었는지 조회해서 가린다
        checkWhyNotAborted(userId, orderId);
    }

    // 실패 기록 UPDATE가 0행일 때 이유를 가려 알맞은 예외를 던진다
    private void checkWhyNotAborted(Long userId, String orderId) {
        // 주문이 없으면 404 (람다는 값이 없을 때만 실행되어 예외를 만든다)
        paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PAY_ORDER_NOT_FOUND));
    }
}
