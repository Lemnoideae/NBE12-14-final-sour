package com.back.nbe1214finalsour.domain.payment.entity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

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
}
