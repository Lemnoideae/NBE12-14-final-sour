package com.back.nbe1214finalsour.domain.click.service;

import com.back.nbe1214finalsour.domain.university.repository.DepartmentRepository;
import com.back.nbe1214finalsour.domain.university.repository.projections.DeptUniv;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.domain.user.repository.projections.UserUniv;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScoreFlushService {

    private final StringRedisTemplate stringRedisTemplate;
    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;

    public void flush() {
        String newUserDirtyKey = RedisKey.DIRTY_USER.of() + ":flushing";
        String newUnivDirtyKey = RedisKey.DIRTY_UNIV.of() + ":flushing";
        String newDeptDirtyKey = RedisKey.DIRTY_DEPT.of() + ":flushing";

        // 개인 점수 저장
        if (detach(RedisKey.DIRTY_USER.of(), newUserDirtyKey)) {
            flushUsers(newUserDirtyKey);
        }

        // 학교 점수 저장
        if (detach(RedisKey.DIRTY_UNIV.of(), newUnivDirtyKey)) {
            flushUnivs(newUnivDirtyKey);
        }

        // 학과 점수 저장
        if (detach(RedisKey.DIRTY_DEPT.of(), newDeptDirtyKey)) {
            flushDepts(newDeptDirtyKey);
        }

        // 기존 dirty 제거
        stringRedisTemplate.delete(List.of(newUserDirtyKey, newUnivDirtyKey, newDeptDirtyKey));
    }

    private boolean detach(String dirtyKey, String flushingKey) {
        boolean hasNew = Boolean.TRUE.equals(stringRedisTemplate.hasKey(dirtyKey));
        boolean hasLeftover = Boolean.TRUE.equals(stringRedisTemplate.hasKey(flushingKey));
        if (hasNew && !hasLeftover) {
            stringRedisTemplate.rename(dirtyKey, flushingKey);
        } else if (hasNew) {
            String incomingKey = dirtyKey + ":incoming";
            stringRedisTemplate.rename(dirtyKey, incomingKey);
            stringRedisTemplate.opsForSet().unionAndStore(flushingKey, incomingKey, flushingKey);
            stringRedisTemplate.delete(incomingKey);
        }
        return hasNew || hasLeftover;
    }

    private void flushDepts(String dirtyKey) {
        List<Long> dirtyDepts = stringRedisTemplate.opsForSet().members(dirtyKey).stream().map(Long::parseLong).toList();

        Map<Long, List<Long>> deptsByUniv = departmentRepository.findUniversityIdsByIdIn(dirtyDepts).stream()
                .collect(Collectors.groupingBy(DeptUniv::universityId,
                        Collectors.mapping(DeptUniv::departmentId, Collectors.toList()))
                );
        List<Long> ids = new ArrayList<>();
        List<Long> scores = new ArrayList<>();

        deptsByUniv.forEach((univId, deptIds) -> {
            String key = RedisKey.RANK_DEPT.of(univId);
            List<Double> values = stringRedisTemplate.opsForZSet()
                    .score(key, deptIds.stream().map(String::valueOf).toArray());
            for (int i = 0; i < deptIds.size(); i++) {
                Double v = values.get(i);
                ids.add(deptIds.get(i));
                scores.add(v.longValue());
            }
        });

        if (ids.isEmpty()) return;

        jdbcTemplate.update("""
                update department as d
                set total_score = x.score
                from unnest(?::bigint[], ?::bigint[]) as x(id, score)
                where d.id = x.id
                    and d.total_score is distinct from x.score
                """, ids.toArray(Long[]::new), scores.toArray(Long[]::new));
    }

    private void flushUnivs(String dirtyKey) {
        Set<String> dirtyUnivs = stringRedisTemplate.opsForSet().members(dirtyKey);

        if (dirtyUnivs == null || dirtyUnivs.isEmpty()) return;

        List<String> univIds = new ArrayList<>(dirtyUnivs);
        List<Double> values = stringRedisTemplate.opsForZSet()
                .score(RedisKey.RANK_UNIV.of(), univIds.toArray());

        List<Long> ids = new ArrayList<>();
        List<Long> scores = new ArrayList<>();
        for (int i = 0; i < univIds.size(); i++) {
            Double v = values.get(i);
            if (v == null) continue;
            ids.add(Long.parseLong(univIds.get(i)));
            scores.add(v.longValue());
        }

        jdbcTemplate.update("""
                update university as u
                set total_score = x.score
                from unnest(?::bigint[], ?::bigint[]) as x(id, score)
                where u.id = x.id
                    and u.total_score is distinct from x.score
                """, ids.toArray(Long[]::new), scores.toArray(Long[]::new));
    }

    private void flushUsers(String dirtyKey) {
        List<Long> dirtyUsers = stringRedisTemplate.opsForSet().members(dirtyKey).stream().map(Long::parseLong).toList();

        Map<Long, List<Long>> usersByUniv = userRepository.findUniversityIdsByIdIn(dirtyUsers).stream()
                .collect(Collectors.groupingBy(
                        UserUniv::universityId,
                        Collectors.mapping(UserUniv::userId, Collectors.toList())
                ));

        List<Long> ids = new ArrayList<>();
        List<Long> scores = new ArrayList<>();
        usersByUniv.forEach((univId, userIds) -> {
            String key = RedisKey.RANK_USER.of(univId);
            List<Double> values = stringRedisTemplate.opsForZSet()
                    .score(key, userIds.stream().map(String::valueOf).toArray());
            for (int i = 0; i < userIds.size(); i++) {
                Double v = values.get(i);
                if (v == null) continue;
                ids.add(userIds.get(i));
                scores.add(v.longValue());
            }
        });

        if (ids.isEmpty()) return;

        jdbcTemplate.update("""
                update users as u 
                set total_contrib_score = x.score
                from unnest(?::bigint[], ?::bigint[]) AS x(id, score)
                where u.id = x.id
                    and u.total_contrib_score is distinct from x.score
                """, ids.toArray(Long[]::new), scores.toArray(Long[]::new));
    }
}
