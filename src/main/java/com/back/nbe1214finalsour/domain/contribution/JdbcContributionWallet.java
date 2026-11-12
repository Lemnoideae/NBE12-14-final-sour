package com.back.nbe1214finalsour.domain.contribution;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.OptionalLong;

@Repository
@RequiredArgsConstructor
public class JdbcContributionWallet implements ContributionWallet {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public OptionalLong tryDeduct(Long userId, long amount) {
        // 잔액 확인과 차감을 UPDATE 한 번에 처리. 잔액이 부족하면 0건이라 결과가 비어 있음
        List<Long> remaining = jdbcTemplate.queryForList("""
                UPDATE users
                SET total_contrib_score = total_contrib_score - ?
                WHERE id = ? AND total_contrib_score >= ?
                RETURNING total_contrib_score
                """, Long.class, amount, userId, amount);

        return remaining.isEmpty()
                ? OptionalLong.empty()
                : OptionalLong.of(remaining.getFirst());
    }

    @Override
    public void restore(Long userId, long amount) {
        jdbcTemplate.update(
                "UPDATE users SET total_contrib_score = total_contrib_score + ? WHERE id = ?",
                amount, userId);
    }
}
