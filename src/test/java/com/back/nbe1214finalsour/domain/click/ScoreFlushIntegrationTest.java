package com.back.nbe1214finalsour.domain.click;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.nbe1214finalsour.IntegrationTest;
import com.back.nbe1214finalsour.domain.click.service.ScoreFlushService;
import com.back.nbe1214finalsour.domain.university.entity.Department;
import com.back.nbe1214finalsour.domain.university.entity.University;
import com.back.nbe1214finalsour.domain.university.repository.DepartmentRepository;
import com.back.nbe1214finalsour.domain.university.repository.UniversityRepository;
import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.global.crypto.EmailHasher;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * 1분 배치가 Redis 점수를 DB에 반영하는지 PostgreSQL·Redis(Testcontainers)로 확인한다.
 *
 * <p>DB 변경은 {@code @Transactional}로 롤백되지만 Redis는 롤백되지 않으므로, 테스트가 쓴 키를 직접 지운다.
 * {@code dirty:*}는 모든 테스트가 함께 쓰는 키라 남기면 다른 테스트에 섞인다.
 */
@IntegrationTest
@Transactional
class ScoreFlushIntegrationTest {

    @Autowired
    private ScoreFlushService scoreFlushService;
    @Autowired
    private StringRedisTemplate stringRedisTemplate;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private UniversityRepository universityRepository;
    @Autowired
    private DepartmentRepository departmentRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private EmailHasher emailHasher;

    private final List<String> usedKeys = new ArrayList<>(List.of(
            RedisKey.DIRTY_USER.of(), RedisKey.DIRTY_UNIV.of(), RedisKey.DIRTY_DEPT.of()));
    /** {@code rank:univ}는 키가 하나뿐이라 통째로 지우지 않고 테스트가 넣은 학교만 뺀다. */
    private final List<String> addedUnivRankMembers = new ArrayList<>();

    @AfterEach
    void cleanUpRedis() {
        stringRedisTemplate.delete(usedKeys);
        if (!addedUnivRankMembers.isEmpty()) {
            stringRedisTemplate.opsForZSet().remove(RedisKey.RANK_UNIV.of(), addedUnivRankMembers.toArray());
        }
    }

    @Test
    @DisplayName("dirty 회원의 Redis 기여도로 DB 기여도를 덮어쓴다")
    void flushesDirtyUserScore() {
        // given
        University university = universityRepository.saveAndFlush(new University("배치테스트대학교"));
        Department department = departmentRepository.saveAndFlush(new Department(university, "배치학과"));
        User user = saveUser(university, department, "배치회원", "flush-user@test.ac.kr");

        String rankKey = RedisKey.RANK_USER.of(university.getId());
        usedKeys.add(rankKey);
        stringRedisTemplate.opsForSet().add(RedisKey.DIRTY_USER.of(), String.valueOf(user.getId()));
        stringRedisTemplate.opsForZSet().add(rankKey, String.valueOf(user.getId()), 500);

        // when
        scoreFlushService.flush();

        // then
        assertThat(contribScoreOf(user.getId())).isEqualTo(500L);
    }

    @Test
    @DisplayName("dirty 학교의 Redis 점수로 DB 학교 점수를 덮어쓴다")
    void flushesDirtyUniversityScore() {
        // given
        University university = universityRepository.saveAndFlush(new University("배치테스트대학교"));
        String univId = String.valueOf(university.getId());

        addedUnivRankMembers.add(univId);
        stringRedisTemplate.opsForSet().add(RedisKey.DIRTY_UNIV.of(), univId);
        stringRedisTemplate.opsForZSet().add(RedisKey.RANK_UNIV.of(), univId, 1200);

        // when
        scoreFlushService.flush();

        // then
        assertThat(universityScoreOf(university.getId())).isEqualTo(1200L);
    }

    @Test
    @DisplayName("dirty 학과의 Redis 점수로 DB 학과 점수를 덮어쓴다")
    void flushesDirtyDepartmentScore() {
        // given
        University university = universityRepository.saveAndFlush(new University("배치테스트대학교"));
        Department department = departmentRepository.saveAndFlush(new Department(university, "배치학과"));
        String deptId = String.valueOf(department.getId());

        String rankKey = RedisKey.RANK_DEPT.of(university.getId());
        usedKeys.add(rankKey);
        stringRedisTemplate.opsForSet().add(RedisKey.DIRTY_DEPT.of(), deptId);
        stringRedisTemplate.opsForZSet().add(rankKey, deptId, 300);

        // when
        scoreFlushService.flush();

        // then
        assertThat(departmentScoreOf(department.getId())).isEqualTo(300L);
    }

    private Long departmentScoreOf(Long departmentId) {
        return jdbcTemplate.queryForObject(
                "SELECT total_score FROM department WHERE id = ?", Long.class, departmentId);
    }

    /** JPA 1차 캐시를 거치지 않도록 DB 값을 직접 읽는다. */
    private Long contribScoreOf(Long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT total_contrib_score FROM users WHERE id = ?", Long.class, userId);
    }

    private Long universityScoreOf(Long universityId) {
        return jdbcTemplate.queryForObject(
                "SELECT total_score FROM university WHERE id = ?", Long.class, universityId);
    }

    private User saveUser(University university, Department department, String nickname, String email) {
        return userRepository.saveAndFlush(User.create(
                university.getId(),
                department.getId(),
                nickname,
                email,
                emailHasher.hash(email),
                "{noop}unused",
                OffsetDateTime.now()));
    }
}
