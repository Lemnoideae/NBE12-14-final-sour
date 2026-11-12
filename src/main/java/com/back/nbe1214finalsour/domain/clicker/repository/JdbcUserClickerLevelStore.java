package com.back.nbe1214finalsour.domain.clicker.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class JdbcUserClickerLevelStore implements UserClickerLevelStore {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public long findLevel(Long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT clicker_id FROM users WHERE id = ?",
                Long.class,
                userId
        );
    }

    @Override
    public boolean changeLevel(Long userId, long expectedLevel, long newLevel) {
        // 현재 레벨이 expectedLevel일 때만 변경. 다른 요청이 먼저 바꿨으면 0건
        int updatedRows = jdbcTemplate.update(
                "UPDATE users SET clicker_id = ? WHERE id = ? AND clicker_id = ?",
                newLevel,
                userId,
                expectedLevel
        );
        return updatedRows == 1;
    }

}
