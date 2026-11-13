package com.back.nbe1214finalsour.domain.contribution;

import com.back.nbe1214finalsour.IntegrationTest;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
public class RedisContributionWalletTest {

    private static final Long USER_ID = 900_001L;
    private static final Long UNIVERSITY_ID = 900_001L;
    private static final String RANK_KEY = "rank:univ:" + UNIVERSITY_ID + ":user";
    private static final String DIRTY_KEY = "dirty:user";

    @Autowired
    private RedisContributionWallet contributionWallet;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @BeforeEach
    void setup(){
        // 교내 기여도 순위 ZSet에 기여도 1000점인 유저
        redisTemplate.opsForZSet().add(RANK_KEY, USER_ID.toString(), 1000);
    }

    @AfterEach
    void tearDown() {
        // Redis는 @Transactional 롤백 대상이 아니라 직접 지운다
        redisTemplate.delete(RANK_KEY);
        redisTemplate.opsForSet().remove(DIRTY_KEY, USER_ID.toString());
    }

    @Test
    @DisplayName("잔액이 충분하면 차감하고 차감 후 잔액을 반환, 배치 대상(dirty:user)에 추가")
    void tryDeduct_success() {
        OptionalLong result = contributionWallet.tryDeduct(USER_ID, UNIVERSITY_ID, 300L);

        assertThat(result).hasValue(700L);
        assertThat(currentScore()).isEqualTo(700.0);
        assertThat(isDirty()).isTrue();
    }

    @Test
    @DisplayName("잔액이 부족하면 차감하지 않고 empty 반환, 배치 대상에도 추가하지 않음")
    void tryDeduct_notEnough() {
        OptionalLong result = contributionWallet.tryDeduct(USER_ID, UNIVERSITY_ID, 1500L);

        assertThat(result).isEmpty();
        assertThat(currentScore()).isEqualTo(1000.0);
        assertThat(isDirty()).isFalse();
    }

    @Test
    @DisplayName("잔액과 차감액이 같으면 0이 되도록 차감")
    void tryDeduct_exactBalance() {
        OptionalLong result = contributionWallet.tryDeduct(USER_ID, UNIVERSITY_ID, 1000L);

        assertThat(result).hasValue(0L);
        assertThat(currentScore()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("ZSet에 없는 유저는 잔액 0으로 보고 empty 반환, ZSet에 추가하지 않음")
    void tryDeduct_noMember() {
        Long otherUserId = 900_002L;

        OptionalLong result = contributionWallet.tryDeduct(otherUserId, UNIVERSITY_ID, 100L);

        assertThat(result).isEmpty();
        assertThat(redisTemplate.opsForZSet().score(RANK_KEY, otherUserId.toString())).isNull();
    }

    @Test
    @DisplayName("복구하면 그만큼 기여도가 다시 늘어나고 배치 대상에 추가")
    void restore() {
        contributionWallet.restore(USER_ID, UNIVERSITY_ID, 300L);

        assertThat(currentScore()).isEqualTo(1300.0);
        assertThat(isDirty()).isTrue();
    }

    private Double currentScore() {
        return redisTemplate.opsForZSet().score(RANK_KEY, USER_ID.toString());
    }

    private boolean isDirty() {
        return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(DIRTY_KEY, USER_ID.toString()));
    }

}
