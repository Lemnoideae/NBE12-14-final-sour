package com.back.nbe1214finalsour.domain.payment.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class ChargeAmountTest {

    @ParameterizedTest(name = "{0}원 → {1}")
    @CsvSource({
        "2500, KRW_2500",
        "5000, KRW_5000",
        "10000, KRW_10000"
    })
    @DisplayName("허용된 금액이면 from은 그 금액의 ChargeAmount를 돌려준다")
    void returnsChargeAmountForAllowedAmount(long amount, ChargeAmount expected) {
        // given: amount, expected (CsvSource)

        // when
        ChargeAmount result = ChargeAmount.from(amount);

        // then
        assertThat(result).isSameAs(expected);
        assertThat(result.getAmount()).isEqualTo(amount);
    }

    @ParameterizedTest(name = "{0}원")
    @ValueSource(longs = {0, -5_000, 2_499, 2_501, 1_000, 30_000})
    @DisplayName("허용되지 않은 금액이면 from은 PAY_INVALID_AMOUNT 예외를 던진다")
    void throwsInvalidAmountForDisallowedAmount(long amount) {
        // given: amount (ValueSource)

        // when & then
        assertThatThrownBy(() -> ChargeAmount.from(amount))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PAY_INVALID_AMOUNT);
    }
}
