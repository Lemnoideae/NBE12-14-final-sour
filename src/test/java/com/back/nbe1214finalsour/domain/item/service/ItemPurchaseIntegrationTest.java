package com.back.nbe1214finalsour.domain.item.service;

import com.back.nbe1214finalsour.IntegrationTest;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
public class ItemPurchaseIntegrationTest {
    private static final long ITEM_ID = 9101L;
    private static final UUID KEY = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");

    @Autowired
    private ItemPurchaseService itemPurchaseService;

    @Autowired
    private ItemService itemService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StringRedisTemplate redisTemplate;

    private Long universityId;
    private Long departmentId;
    private Long userId;

    @BeforeEach
    void setUp() {
        // users는 학교·학과 FK가 필수라 먼저 만든다
        universityId = jdbcTemplate.queryForObject(
                "INSERT INTO university (name) VALUES ('물약테스트대') RETURNING id", Long.class);
        departmentId = jdbcTemplate.queryForObject(
                "INSERT INTO department (university_id, name) VALUES (?, '컴퓨터공학과') RETURNING id",
                Long.class, universityId);
        userId = jdbcTemplate.queryForObject("""
                INSERT INTO users (university_id, department_id, nickname, email, email_hash, password, approved_at)
                VALUES (?, ?, '물약유저', 'potion@test.com', ?, 'password', now())
                RETURNING id
                """, Long.class, universityId, departmentId, "b".repeat(64));

        // 기여도 500, 1시간, 2배 물약
        jdbcTemplate.update("""
                INSERT INTO item (id, name, content, type, pay_type, price, duration, multiplier)
                VALUES (?, '테스트 2배 물약', '1시간 동안 클릭 점수 2배', 'MULTIPLIER', 'CONTRIBUTION', 500, 3600, 2.0)
                """, ITEM_ID);
        // 아이템 목록은 서버 시작 시 메모리에 올라가므로, 방금 넣은 물약이 보이도록 다시 적재
        itemService.loadItemTable();

        // 기여도 원본은 Redis ZSET. 1000점 보유
        redisTemplate.opsForZSet().add(rankKey(), String.valueOf(userId), 1000);
    }

    @AfterEach
    void tearDown() {
        redisTemplate.delete(effectKey());
        redisTemplate.delete(RedisKey.PURCHASE_DEDUPE.of(userId, KEY));
        redisTemplate.delete(RedisKey.USER_EFFECT_VOIDED.of(userId));
        redisTemplate.delete(rankKey());
        redisTemplate.opsForSet().remove("dirty:user", String.valueOf(userId));

        jdbcTemplate.update("DELETE FROM user_item WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM item WHERE id = ?", ITEM_ID);
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        jdbcTemplate.update("DELETE FROM department WHERE id = ?", departmentId);
        jdbcTemplate.update("DELETE FROM university WHERE id = ?", universityId);
        // 지운 물약이 다른 테스트의 아이템 목록 캐시에 남지 않게 다시 적재
        itemService.loadItemTable();
    }

    private String effectKey() {
        return "user:" + userId + ":effect";
    }

    private String rankKey() {
        return "rank:univ:" + universityId + ":user";
    }

    @Test
    @DisplayName("물약을 사면 기여도 차감·효과 적용·멱등 키 기록 후 구매 이력을 커밋한다")
    void purchase_appliesEffectAndRecordsHistory() {
        // when
        itemPurchaseService.purchase(userId, universityId, null, ITEM_ID, null, KEY);

        // then: 기여도 1000 → 500
        assertThat(redisTemplate.opsForZSet().score(rankKey(), String.valueOf(userId))).isEqualTo(500.0);
        // 구매 이력 1건 (커밋됨)
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_item WHERE user_id = ?", Long.class, userId)).isEqualTo(1L);
        // 구매 Lua가 효과를 적용 → 클릭 엔진이 읽는 배율, 효과 주인은 요청의 멱등 키
        assertThat(redisTemplate.opsForHash().get(effectKey(), "multiplier")).isEqualTo("2.0");
        assertThat(redisTemplate.opsForHash().get(effectKey(), "purchaseId")).isEqualTo(KEY.toString());
    }
}
