package com.back.nbe1214finalsour.domain.click.service;

import com.back.nbe1214finalsour.domain.click.dto.UniversityActivityResponse;
import com.back.nbe1214finalsour.domain.university.repository.UniversityCache;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ClickActivityService {

    private final StringRedisTemplate stringRedisTemplate;
    private final UniversityCache universityCache;

    public UniversityActivityResponse getActivity(Long universityId) {
        // 없는 학교면 UNIV_NOT_FOUND
        universityCache.getName(universityId);

        long preSec = Instant.now().getEpochSecond() - 1;
        List<String> keys = List.of(RedisKey.CLICKS_UNIV_SECOND.of(universityId, preSec),
                RedisKey.ATTACKS_UNIV_SECOND.of(universityId, preSec),
                RedisKey.ASSISTS_UNIV_SECOND.of(universityId, preSec));
        List<Long> activity = stringRedisTemplate.opsForValue().multiGet(keys)
                .stream().map(str -> {
                    if (str != null && !str.isEmpty()) {
                        return Long.parseLong(str);
                    } else {
                        return 0L;
                    }
                }).toList();


        return new UniversityActivityResponse(preSec, activity.get(0), activity.get(1), activity.get(2));
    }
}
