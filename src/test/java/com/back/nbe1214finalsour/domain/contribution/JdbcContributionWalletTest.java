package com.back.nbe1214finalsour.domain.contribution;

import com.back.nbe1214finalsour.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
@Transactional
public class JdbcContributionWalletTest {
    @Autowired
    private JdbcContributionWallet contributionWallet;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long userId;

    private long currentScore() {
        return jdbcTemplate.queryForObject(
                "SELECT total_contrib_score FROM users WHERE id = ?", Long.class, userId);
    }

    @BeforeEach
    void setUp() {
        Long universityId = jdbcTemplate.queryForObject(
                "INSERT INTO university (name) VALUES ('지갑테스트대') RETURNING id", Long.class);
        Long departmentId = jdbcTemplate.queryForObject(
                "INSERT INTO department (university_id, name) VALUES (?, '컴퓨터공학과') RETURNING id",
                Long.class, universityId);

        // 기여도 1000점을 가진 유저
        userId = jdbcTemplate.queryForObject("""
                INSERT INTO users (university_id, department_id, nickname, email, email_hash, password, approved_at, total_contrib_score)
                VALUES (?, ?, '지갑유저', 'wallet@test.com', ?, 'password', now(), 1000)
                RETURNING id
                """, Long.class, universityId, departmentId, "b".repeat(64));
    }

    @Test
    @DisplayName("잔액이 충분하면 차감하고 차감 후 잔액을 반환")
    void tryDeduct_success() {
        OptionalLong result = contributionWallet.tryDeduct(userId, 300L);

        assertThat(result).hasValue(700L);
        assertThat(currentScore()).isEqualTo(700L);
    }

    @Test
    @DisplayName("잔액이 부족하면 차감하지 않고 empty 반환")
    void tryDeduct_notEnough() {
        OptionalLong result = contributionWallet.tryDeduct(userId, 1500L);

        assertThat(result).isEmpty();
        assertThat(currentScore()).isEqualTo(1000L);
    }

    @Test
    @DisplayName("잔액과 차감액이 같으면 0이 되도록 차감")
    void tryDeduct_exactBalance() {
        OptionalLong result = contributionWallet.tryDeduct(userId, 1000L);

        assertThat(result).hasValue(0L);
        assertThat(currentScore()).isEqualTo(0L);
    }

    @Test
    @DisplayName("복구하면 그만큼 기여도가 다시 늘어남")
    void restore() {
        contributionWallet.restore(userId, 300L);

        assertThat(currentScore()).isEqualTo(1300L);
    }
}
