package com.back.nbe1214finalsour;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class RedisConnectionTest {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Test
    @DisplayName("Redis에 값을 쓰고 읽을 수 있다")
    void writeAndRead() {
        redisTemplate.opsForValue().set("ci:test", "ok");

        assertThat(redisTemplate.opsForValue().get("ci:test")).isEqualTo("ok");
    }

    @Test
    @DisplayName("INCRBY로 값이 누적된다")
    void incrementBy() {
        redisTemplate.delete("ci:counter");

        redisTemplate.opsForValue().increment("ci:counter", 3);
        redisTemplate.opsForValue().increment("ci:counter", 5);

        assertThat(redisTemplate.opsForValue().get("ci:counter")).isEqualTo("8");
    }
}