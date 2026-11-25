package com.back.nbe1214finalsour.domain.payment.entity;

import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ChargeAmount {
    KRW_2500(2_500),
    KRW_5000(5_000),
    KRW_10000(10_000);

    private final long amount;

    public static ChargeAmount from(long amount) {
        return Arrays.stream(values())
                .filter(chargeAmount -> chargeAmount.amount == amount)
                .findFirst()
                .orElseThrow();
    }
}
