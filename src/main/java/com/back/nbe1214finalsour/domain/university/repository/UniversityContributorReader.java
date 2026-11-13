package com.back.nbe1214finalsour.domain.university.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
public class UniversityContributorReader {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public Map<Long, String> findNicknames(
            Long universityId,
            List<Long> userIds
    ) {
        if (userIds.isEmpty()) {
            return Map.of();
        }

        String sql = """
                SELECT id, nickname
                FROM users
                WHERE university_id = :universityId
                  AND id IN (:userIds)
                  AND status = 'ACTIVE'
                  AND deleted_at IS NULL
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("universityId", universityId)
                .addValue("userIds", userIds);

        return jdbcTemplate.query(
                sql,
                params,
                (rs, rowNum) -> Map.entry(
                        rs.getLong("id"),
                        rs.getString("nickname")
                )
        ).stream().collect(Collectors.toMap(
                Map.Entry::getKey,
                Map.Entry::getValue
        ));
    }
}
