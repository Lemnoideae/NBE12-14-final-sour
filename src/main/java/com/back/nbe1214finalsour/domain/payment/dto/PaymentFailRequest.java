package com.back.nbe1214finalsour.domain.payment.dto;

// 결제 실패 기록 요청. orderId는 failUrl 쿼리가 아니라 주문 생성 응답에서 받은 값을 보낸다
// (토스는 주문이 생성되지 않고 이탈한 일부 에러에서 failUrl에 orderId를 주지 않는다)
public record PaymentFailRequest(String orderId, String code, String message) {
}
