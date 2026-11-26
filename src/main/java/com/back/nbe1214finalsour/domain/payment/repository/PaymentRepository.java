package com.back.nbe1214finalsour.domain.payment.repository;

import com.back.nbe1214finalsour.domain.payment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            UPDATE payment
               SET status = 'ABORTED', fail_code = :failCode, fail_message = :failMessage
             WHERE order_id = :orderId
               AND user_id = :userId
            """, nativeQuery = true)
    int abortIfReady(@Param("orderId") String orderId, @Param("userId") Long userId,
                     @Param("failCode") String failCode, @Param("failMessage") String failMessage);
}
