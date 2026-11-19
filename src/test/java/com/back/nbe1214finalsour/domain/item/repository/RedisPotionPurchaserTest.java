package com.back.nbe1214finalsour.domain.item.repository;

import com.back.nbe1214finalsour.IntegrationTest;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** 물약 구매·보상 Lua를 실제 Redis로 검증한다 (@Transactional 없음: Redis만 쓴다). */
@IntegrationTest
class RedisPotionPurchaserTest {

    private static final long USER_ID = 900_40L;
    private static final long UNIVERSITY_ID = 900_41L;
    private static final long ITEM_ID = 900_42L;
    private static final long OTHER_ITEM_ID = 900_43L;
    private static final UUID KEY = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID OTHER_KEY = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static final String RANK_KEY = RedisKey.RANK_USER.of(UNIVERSITY_ID);
    private static final String DIRTY_KEY = RedisKey.DIRTY_USER.of();
    private static final String EFFECT_KEY = RedisKey.USER_EFFECT.of(USER_ID);
    private static final String DEDUPE_KEY = RedisKey.PURCHASE_DEDUPE.of(USER_ID, KEY);

    @Autowired
    private RedisPotionPurchaser purchaser;

    @Autowired
    private StringRedisTemplate redis;

    @AfterEach
    void cleanUp() {
        redis.opsForZSet().remove(RANK_KEY, String.valueOf(USER_ID));
        redis.opsForSet().remove(DIRTY_KEY, String.valueOf(USER_ID));
        redis.delete(EFFECT_KEY);
        redis.delete(DEDUPE_KEY);
    }

    @Test
    @DisplayName("기여도가 충분하면 차감하고 효과와 멱등 키를 남긴다")
    void purchase_success() {
        // given
        redis.opsForZSet().add(RANK_KEY, String.valueOf(USER_ID), 1000);
        OffsetDateTime expiredAt = OffsetDateTime.now(ZoneOffset.UTC).plusHours(1).truncatedTo(ChronoUnit.MILLIS);

        // when
        PotionPurchaseOutcome outcome = purchaser.purchase(
                USER_ID, UNIVERSITY_ID, ITEM_ID, 300L, 2.0, expiredAt, KEY);

        // then
        assertThat(outcome).isEqualTo(new PotionPurchaseOutcome(700, ""));
        assertThat(redis.opsForZSet().score(RANK_KEY, String.valueOf(USER_ID))).isEqualTo(700.0);
        assertThat(redis.opsForSet().isMember(DIRTY_KEY, String.valueOf(USER_ID))).isTrue();
        Map<String, String> effect = redis.<String, String>opsForHash().entries(EFFECT_KEY);
        assertThat(effect).containsExactlyInAnyOrderEntriesOf(Map.of(
                "itemId", String.valueOf(ITEM_ID),
                "multiplier", "2.0",
                "expiredAt", String.valueOf(expiredAt.toInstant().toEpochMilli()),
                "purchaseId", KEY.toString()));
        assertThat(redis.getExpire(EFFECT_KEY, TimeUnit.MILLISECONDS)).isBetween(1L, 3_600_000L);
        assertThat(redis.opsForValue().get(DEDUPE_KEY)).isEqualTo("1");
        assertThat(redis.getExpire(DEDUPE_KEY, TimeUnit.MILLISECONDS)).isBetween(1L, 300_000L);
    }

    @Test
    @DisplayName("다른 구매의 효과가 있으면 새 효과로 덮어쓰고 이전 효과를 돌려준다")
    void purchase_returnsPreviousEffect() {
        // given
        redis.opsForZSet().add(RANK_KEY, String.valueOf(USER_ID), 1000);
        OffsetDateTime previousExpiredAt = OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(30).truncatedTo(ChronoUnit.MILLIS);
        Map<String, String> previous = Map.of(
                "itemId", String.valueOf(OTHER_ITEM_ID),
                "multiplier", "4.0",
                "expiredAt", String.valueOf(previousExpiredAt.toInstant().toEpochMilli()),
                "purchaseId", OTHER_KEY.toString());
        redis.opsForHash().putAll(EFFECT_KEY, previous);
        redis.expireAt(EFFECT_KEY, previousExpiredAt.toInstant());
        OffsetDateTime expiredAt = OffsetDateTime.now(ZoneOffset.UTC).plusHours(1).truncatedTo(ChronoUnit.MILLIS);

        // when
        PotionPurchaseOutcome outcome = purchaser.purchase(
                USER_ID, UNIVERSITY_ID, ITEM_ID, 300L, 2.0, expiredAt, KEY);

        // then
        assertThat(outcome.code()).isEqualTo(700);
        assertThat(outcome.previousEffect()).isNotEmpty();
        Map<String, String> returned = JSON.readValue(outcome.previousEffect(), new TypeReference<Map<String, String>>() {});
        assertThat(returned).containsExactlyInAnyOrderEntriesOf(previous);
        Map<String, String> effect = redis.<String, String>opsForHash().entries(EFFECT_KEY);
        assertThat(effect).containsEntry("itemId", String.valueOf(ITEM_ID))
                .containsEntry("purchaseId", KEY.toString());
        assertThat(redis.getExpire(EFFECT_KEY, TimeUnit.MILLISECONDS)).isGreaterThan(1_800_000L);
    }

    @Test
    @DisplayName("기여도가 부족하면 -1을 돌려주고 아무것도 바꾸지 않는다")
    void purchase_notEnoughScore() {
        // given
        redis.opsForZSet().add(RANK_KEY, String.valueOf(USER_ID), 100);
        OffsetDateTime previousExpiredAt = OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(30).truncatedTo(ChronoUnit.MILLIS);
        Map<String, String> previous = Map.of(
                "itemId", String.valueOf(OTHER_ITEM_ID),
                "multiplier", "4.0",
                "expiredAt", String.valueOf(previousExpiredAt.toInstant().toEpochMilli()),
                "purchaseId", OTHER_KEY.toString());
        redis.opsForHash().putAll(EFFECT_KEY, previous);
        redis.expireAt(EFFECT_KEY, previousExpiredAt.toInstant());
        OffsetDateTime expiredAt = OffsetDateTime.now(ZoneOffset.UTC).plusHours(1).truncatedTo(ChronoUnit.MILLIS);

        // when
        PotionPurchaseOutcome outcome = purchaser.purchase(
                USER_ID, UNIVERSITY_ID, ITEM_ID, 300L, 2.0, expiredAt, KEY);

        // then
        assertThat(outcome).isEqualTo(new PotionPurchaseOutcome(-1, ""));
        assertThat(redis.opsForZSet().score(RANK_KEY, String.valueOf(USER_ID))).isEqualTo(100.0);
        assertThat(redis.opsForSet().isMember(DIRTY_KEY, String.valueOf(USER_ID))).isFalse();
        assertThat(redis.<String, String>opsForHash().entries(EFFECT_KEY)).containsExactlyInAnyOrderEntriesOf(previous);
        assertThat(redis.hasKey(DEDUPE_KEY)).isFalse();
    }

    @Test
    @DisplayName("기여도 기록이 없으면 -1을 돌려주고 아무것도 만들지 않는다")
    void purchase_noContributionRecord() {
        // given
        OffsetDateTime expiredAt = OffsetDateTime.now(ZoneOffset.UTC).plusHours(1).truncatedTo(ChronoUnit.MILLIS);

        // when
        PotionPurchaseOutcome outcome = purchaser.purchase(
                USER_ID, UNIVERSITY_ID, ITEM_ID, 300L, 2.0, expiredAt, KEY);

        // then
        assertThat(outcome).isEqualTo(new PotionPurchaseOutcome(-1, ""));
        assertThat(redis.opsForZSet().score(RANK_KEY, String.valueOf(USER_ID))).isNull();
        assertThat(redis.opsForSet().isMember(DIRTY_KEY, String.valueOf(USER_ID))).isFalse();
        assertThat(redis.hasKey(EFFECT_KEY)).isFalse();
        assertThat(redis.hasKey(DEDUPE_KEY)).isFalse();
    }
}
