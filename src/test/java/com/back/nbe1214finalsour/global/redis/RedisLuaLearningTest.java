package com.back.nbe1214finalsour.global.redis;

import com.back.nbe1214finalsour.IntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Lua 동작에 대한 가정을 실제 Redis로 확인하는 학습 테스트. */
@IntegrationTest
class RedisLuaLearningTest {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @SuppressWarnings("rawtypes")
    private List run(String lua) {
        return stringRedisTemplate.execute(new DefaultRedisScript<>(lua, List.class), List.of());
    }

    @Test
    @DisplayName("Lua가 숫자와 문자열이 섞인 테이블을 반환하면 RedisScript<List>는 Long과 String으로 변환한다")
    @SuppressWarnings("rawtypes")
    void luaTableReturn_mixedTypes() {
        // given
        String withEffect = "return {1000, '{\"itemId\":\"1\"}'}";
        String withoutEffect = "return {1000, ''}";
        String failure = "return {-1}";

        // when
        List first = run(withEffect);
        List second = run(withoutEffect);
        List third = run(failure);

        // then
        assertThat(first).containsExactly(1000L, "{\"itemId\":\"1\"}");
        assertThat(second).containsExactly(1000L, "");
        assertThat(third).containsExactly(-1L);
    }
}
