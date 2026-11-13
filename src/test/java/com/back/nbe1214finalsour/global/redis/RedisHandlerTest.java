package com.back.nbe1214finalsour.global.redis;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.nbe1214finalsour.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@IntegrationTest
class RedisHandlerTest {

    private static final String HASH_KEY = "handler:hash";
    private static final String TTL_KEY = "handler:ttl";

    @Autowired
    private RedisHandler redisHandler;
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @BeforeEach
    void clear() {
        redisTemplate.delete(List.of(HASH_KEY, TTL_KEY));
    }

    @Test
    @DisplayName("Hash 필드에 객체를 쓰고 읽을 수 있다")
    void setHashAndGetHash() {
        LocalDateTime now = LocalDateTime.now();
        TempPost tempPost = new TempPost("제목", "내용", now);

        redisHandler.setHash(HASH_KEY, "post1", tempPost);
        TempPost findTempPost = redisHandler.getHash(HASH_KEY, "post1", TempPost.class).get();

        assertThat(findTempPost.title()).isEqualTo("제목");
        assertThat(findTempPost.content()).isEqualTo("내용");
        assertThat(findTempPost.createdAt()).isEqualTo(now);
    }

    @Test
    @DisplayName("없는 Hash 필드를 조회하면 Optional.empty")
    void getHashReturnsEmptyWhenFieldMissing() {
        assertThat(redisHandler.getHash(HASH_KEY, "없는필드", TempPost.class)).isEmpty();
    }

    @Test
    @DisplayName("setTtl로 저장한 키에는 만료가 걸린다")
    void setTtlAppliesExpiration() {
        redisHandler.setTtl(TTL_KEY, new TempPost("제목", "내용", LocalDateTime.now()), Duration.ofMinutes(10));

        assertThat(redisHandler.get(TTL_KEY, TempPost.class)).isPresent();
        assertThat(redisTemplate.getExpire(TTL_KEY))
                .isPositive()
                .isLessThanOrEqualTo(Duration.ofMinutes(10).toSeconds());
    }

    @Test
    @DisplayName("set으로 저장한 키에는 만료가 없다")
    void setDoesNotApplyExpiration() {
        redisHandler.set(TTL_KEY, new TempPost("제목", "내용", LocalDateTime.now()));

        // Redis는 만료가 없는 키의 TTL을 -1로 응답한다
        assertThat(redisTemplate.getExpire(TTL_KEY)).isEqualTo(-1L);
    }

    @Test
    @DisplayName("setHashFieldTtl은 필드를 저장하면서 필드 단위 만료를 건다")
    void setHashFieldTtlAppliesExpirationPerField() {
        LocalDateTime now = LocalDateTime.now();
        Map<String, Object> fields = Map.of("post1", new TempPost("제목", "내용", now));

        redisHandler.setHashFieldTtl(HASH_KEY, fields, Duration.ofMinutes(10));

        assertThat(redisHandler.getHash(HASH_KEY, "post1", TempPost.class).get().title()).isEqualTo("제목");

        HashOperations<String, String, Object> hashOperations = redisTemplate.opsForHash();
        Duration ttl = hashOperations.getTimeToLive(HASH_KEY, List.of("post1")).ttlOf("post1");

        assertThat(ttl).isNotNull()
                .isGreaterThan(Duration.ZERO)
                .isLessThanOrEqualTo(Duration.ofMinutes(10));
    }

    @Test
    @DisplayName("setHash로만 저장한 필드에는 만료가 없다")
    void setHashDoesNotApplyExpiration() {
        redisHandler.setHash(HASH_KEY, "post1", new TempPost("제목", "내용", LocalDateTime.now()));

        HashOperations<String, String, Object> hashOperations = redisTemplate.opsForHash();

        assertThat(hashOperations.getTimeToLive(HASH_KEY, List.of("post1")).persistent())
                .containsExactly("post1");
    }

    record TempPost(
            String title,
            String content,
            LocalDateTime createdAt
    ) {}
}
