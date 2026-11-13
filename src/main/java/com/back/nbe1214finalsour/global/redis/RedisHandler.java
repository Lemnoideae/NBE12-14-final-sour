package com.back.nbe1214finalsour.global.redis;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.connection.RedisHashCommands;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class RedisHandler {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    // String 설정
    public void set(String key, Object value) {
        redisTemplate.opsForValue().set(key, value);
    }

    // String TTL 설정
    public void setTtl(String key, Object value, Duration ttl) {
        redisTemplate.opsForValue().set(key, value, ttl);
    }

    // Hash 설정
    public void setHash(String key, String hashKey, Object value) {
        redisTemplate.opsForHash().put(key, hashKey, value);
    }

    // Hash TTL 설정, 이미 데이터가 저장되어 있어야 함
    public void setHashFieldTtl(String key, Map<String, Object> hashKeyValue, Duration ttl) {
        redisTemplate.opsForHash().putAndExpire(
                key, hashKeyValue, RedisHashCommands.HashFieldSetOption.UPSERT, Expiration.from(ttl)
        );
    }

    // String 값 조회
    public <T> Optional<T> get(String key, Class<T> type) {
        Object object = redisTemplate.opsForValue().get(key);
        return Optional.ofNullable(object).map(o -> objectMapper.convertValue(o, type));
    }

    // Hash 값 조회
    public <T> Optional<T> getHash(String key, String hashKey, Class<T> type) {
        Object object = redisTemplate.opsForHash().get(key, hashKey);
        return Optional.ofNullable(object).map(o -> objectMapper.convertValue(o, type));
    }

    // 값이 없으면 0부터 시작, +1 증가
    public long increment(String key) {
        Long value = redisTemplate.opsForValue().increment(key);
        return value != null ? value : 0L;
    }

    // increment + 유효 기한 설정
    public long incrementWithTtl(String key, Duration ttl) {
        long value = increment(key);
        if (value == 1L) {
            redisTemplate.expire(key, ttl);
        }
        return value;
    }

    // hash 값 증가, delta -> 증가할 값
    public long incrementHash(String key, String hashKey, long delta) {
        Long value = redisTemplate.opsForHash().increment(key, hashKey, delta);
        return value != null ? value : 0L;
    }

    // SET NX(값이 없으면) + TTL
    // Increment 대상으로 쓰면 안됩니다.
    public boolean setIfAbsent(String key, Object value, Duration ttl) {
        return Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(key, value, ttl));
    }

    public boolean delete(String key) {
        return Boolean.TRUE.equals(redisTemplate.delete(key));
    }

    public boolean expire(String key, Duration ttl) {
        return Boolean.TRUE.equals(redisTemplate.expire(key, ttl));
    }
}
