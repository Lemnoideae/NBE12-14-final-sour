package com.back.nbe1214finalsour.domain.payment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.back.nbe1214finalsour.domain.payment.entity.ChargeAmount;
import com.back.nbe1214finalsour.domain.payment.entity.Payment;
import com.back.nbe1214finalsour.domain.payment.repository.PaymentRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    private static final Long USER_ID = 1L;
    private static final String ORDER_ID = "b6f1e2d3-8a7c-4b5e-9f0a-1c2d3e4f5a6b";
    private static final String CODE = "PAY_PROCESS_CANCELED";
    private static final String MESSAGE = "사용자에 의해 결제가 취소되었습니다.";

    @Mock
    private PaymentRepository paymentRepository;

    @InjectMocks
    private PaymentService paymentService;

    @Test
    @DisplayName("주문을 만들면 그 회원·금액의 주문을 저장하고 저장 결과를 돌려준다")
    void createOrderSavesReadyPayment() {
        // given
        Payment stored = Payment.ready(1L, ChargeAmount.KRW_5000); // 리포지토리가 돌려줄 객체
        given(paymentRepository.save(any(Payment.class))).willReturn(stored);

        // when
        Payment result = paymentService.createOrder(1L, ChargeAmount.KRW_5000);

        // then
        ArgumentCaptor<Payment> captor = ArgumentCaptor.forClass(Payment.class);
        then(paymentRepository).should().save(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(1L);
        assertThat(captor.getValue().getAmount()).isEqualTo(5_000L);
        assertThat(result).isSameAs(stored);
    }

    @Test
    @DisplayName("실패 기록 UPDATE가 1행이면 주문을 조회하지 않고 끝난다")
    void recordFailEndsWithoutLookupWhenUpdated() {
        // given
        given(paymentRepository.abortIfReady(ORDER_ID, USER_ID, CODE, MESSAGE)).willReturn(1);

        // when
        paymentService.recordFail(USER_ID, ORDER_ID, CODE, MESSAGE);

        // then
        then(paymentRepository).should().abortIfReady(ORDER_ID, USER_ID, CODE, MESSAGE);
        then(paymentRepository).shouldHaveNoMoreInteractions();
    }
}
