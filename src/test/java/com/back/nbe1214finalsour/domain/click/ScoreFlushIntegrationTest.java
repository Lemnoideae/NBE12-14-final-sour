package com.back.nbe1214finalsour.domain.click;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;

import com.back.nbe1214finalsour.IntegrationTest;
import com.back.nbe1214finalsour.domain.click.service.ScoreFlushService;
import com.back.nbe1214finalsour.domain.university.entity.Department;
import com.back.nbe1214finalsour.domain.university.entity.University;
import com.back.nbe1214finalsour.domain.university.repository.DepartmentRepository;
import com.back.nbe1214finalsour.domain.university.repository.UniversityRepository;
import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.domain.user.repository.projections.UserUniv;
import com.back.nbe1214finalsour.global.crypto.EmailHasher;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
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
    /** 배치 도중에 클릭이 들어오는 순간을 만들기 위해 감싼다. 따로 설정하지 않으면 실제 메서드가 그대로 돈다. */
    @MockitoSpyBean
    private UserRepository userRepository;
    @Autowired
    private EmailHasher emailHasher;

    private final List<String> usedKeys = new ArrayList<>(List.of(
            RedisKey.DIRTY_USER.of(), RedisKey.DIRTY_UNIV.of(), RedisKey.DIRTY_DEPT.of(),
            // 테스트가 중간에 실패하면 배치가 떼어 낸 키가 남는다
            RedisKey.DIRTY_USER.of() + ":flushing", RedisKey.DIRTY_UNIV.of() + ":flushing",
            RedisKey.DIRTY_DEPT.of() + ":flushing"));
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

    @Test
    @DisplayName("반영한 뒤에는 dirty 표시를 지워 다음 배치가 다시 쓰지 않게 한다")
    void clearsDirtySetsAfterFlush() {
        // given
        University university = universityRepository.saveAndFlush(new University("배치테스트대학교"));
        Department department = departmentRepository.saveAndFlush(new Department(university, "배치학과"));
        User user = saveUser(university, department, "배치회원", "flush-clear@test.ac.kr");
        String univId = String.valueOf(university.getId());
        String deptId = String.valueOf(department.getId());
        String userId = String.valueOf(user.getId());

        String deptRankKey = RedisKey.RANK_DEPT.of(university.getId());
        String userRankKey = RedisKey.RANK_USER.of(university.getId());
        usedKeys.add(deptRankKey);
        usedKeys.add(userRankKey);
        addedUnivRankMembers.add(univId);

        stringRedisTemplate.opsForSet().add(RedisKey.DIRTY_UNIV.of(), univId);
        stringRedisTemplate.opsForSet().add(RedisKey.DIRTY_DEPT.of(), deptId);
        stringRedisTemplate.opsForSet().add(RedisKey.DIRTY_USER.of(), userId);
        stringRedisTemplate.opsForZSet().add(RedisKey.RANK_UNIV.of(), univId, 100);
        stringRedisTemplate.opsForZSet().add(deptRankKey, deptId, 100);
        stringRedisTemplate.opsForZSet().add(userRankKey, userId, 100);

        // when
        scoreFlushService.flush();

        // then
        assertThat(stringRedisTemplate.opsForSet().size(RedisKey.DIRTY_UNIV.of())).isZero();
        assertThat(stringRedisTemplate.opsForSet().size(RedisKey.DIRTY_DEPT.of())).isZero();
        assertThat(stringRedisTemplate.opsForSet().size(RedisKey.DIRTY_USER.of())).isZero();
    }

    @Test
    @DisplayName("배치가 도는 중에 dirty가 된 회원은 지우지 않고 다음 배치로 넘긴다")
    void keepsUsersMarkedDirtyDuringFlush() {
        // given
        University university = universityRepository.saveAndFlush(new University("배치테스트대학교"));
        Department department = departmentRepository.saveAndFlush(new Department(university, "배치학과"));
        User before = saveUser(university, department, "배치전회원", "flush-before@test.ac.kr");
        User during = saveUser(university, department, "배치중회원", "flush-during@test.ac.kr");
        String duringId = String.valueOf(during.getId());

        String rankKey = RedisKey.RANK_USER.of(university.getId());
        usedKeys.add(rankKey);
        stringRedisTemplate.opsForSet().add(RedisKey.DIRTY_USER.of(), String.valueOf(before.getId()));
        stringRedisTemplate.opsForZSet().add(rankKey, String.valueOf(before.getId()), 500);

        // 배치가 dirty 회원을 읽어 DB를 조회하는 순간, 다른 회원의 클릭이 들어온 것처럼 만든다.
        // 레포지토리는 JDK 프록시라 실제 메서드를 부를 수 없어서, 조회 결과(모두 이 학교 소속)를 직접 돌려준다.
        doAnswer(invocation -> {
            stringRedisTemplate.opsForZSet().add(rankKey, duringId, 70);
            stringRedisTemplate.opsForSet().add(RedisKey.DIRTY_USER.of(), duringId);
            Collection<Long> ids = invocation.getArgument(0);
            return ids.stream().map(id -> new UserUniv(id, university.getId())).toList();
        }).when(userRepository).findUniversityIdsByIdIn(anyCollection());

        // when
        scoreFlushService.flush();

        // then
        assertThat(stringRedisTemplate.opsForSet().members(RedisKey.DIRTY_USER.of()))
                .containsExactly(duringId);
    }

    @Test
    @DisplayName("반영 중에 실패한 회원은 잃지 않고 다음 배치에서 다시 반영한다")
    void retriesUsersFromFailedFlush() {
        // given
        University university = universityRepository.saveAndFlush(new University("배치테스트대학교"));
        Department department = departmentRepository.saveAndFlush(new Department(university, "배치학과"));
        User failed = saveUser(university, department, "실패회원", "flush-failed@test.ac.kr");
        User next = saveUser(university, department, "다음회원", "flush-next@test.ac.kr");

        String rankKey = RedisKey.RANK_USER.of(university.getId());
        usedKeys.add(rankKey);
        stringRedisTemplate.opsForSet().add(RedisKey.DIRTY_USER.of(), String.valueOf(failed.getId()));
        stringRedisTemplate.opsForZSet().add(rankKey, String.valueOf(failed.getId()), 500);

        // 첫 배치는 회원을 조회하다 실패하고, 그다음부터는 정상 조회(모두 이 학교 소속)를 돌려준다.
        // DB 오류로 실패시키면 테스트 트랜잭션이 깨져 두 번째 배치를 돌릴 수 없어서 조회 단계에서 실패시킨다.
        doThrow(new IllegalStateException("DB 장애"))
                .doAnswer(invocation -> {
                    Collection<Long> ids = invocation.getArgument(0);
                    return ids.stream().map(id -> new UserUniv(id, university.getId())).toList();
                })
                .when(userRepository).findUniversityIdsByIdIn(anyCollection());

        assertThatThrownBy(() -> scoreFlushService.flush()).isInstanceOf(IllegalStateException.class);

        // 실패한 뒤 다른 회원이 클릭한다
        stringRedisTemplate.opsForSet().add(RedisKey.DIRTY_USER.of(), String.valueOf(next.getId()));
        stringRedisTemplate.opsForZSet().add(rankKey, String.valueOf(next.getId()), 70);

        // when
        scoreFlushService.flush();

        // then
        assertThat(contribScoreOf(failed.getId())).isEqualTo(500L);
        assertThat(contribScoreOf(next.getId())).isEqualTo(70L);
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
