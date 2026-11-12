package com.back.nbe1214finalsour.domain.university;

import com.back.nbe1214finalsour.IntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
class UniversitySeedIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Flyway가 76개 학교와 6696개 학과를 등록한다")
    void expectedSeedCounts() {
        Long universityCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM university", Long.class);
        Long departmentCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM department", Long.class);

        assertThat(universityCount).isEqualTo(76L);
        assertThat(departmentCount).isEqualTo(6696L);
    }

    @Test
    @DisplayName("모든 학교에 최소 1개 학과가 연결되어 있다")
    void allUniversitiesHaveDepartments() {
        Long missingCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM university u
                WHERE NOT EXISTS (
                    SELECT 1 FROM department d WHERE d.university_id = u.id
                )
                """, Long.class);

        assertThat(missingCount).isZero();
    }

    @Test
    @DisplayName("추가 학교와 학과 데이터가 존재한다")
    void importantSchoolsExist() {
        Long matched = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM university
                WHERE name IN ('서울대학교', '국민대학교', 'DGIST')
                """, Long.class);
        assertThat(matched).isEqualTo(3L);
    }
}
