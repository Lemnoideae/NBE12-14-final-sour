package com.back.nbe1214finalsour.domain.university.repository;

import com.back.nbe1214finalsour.domain.university.repository.projections.UnivName;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class UniversityNameCache {

    private final UniversityRepository universityRepository;
    private volatile Map<Long, String> names = Map.of();

    @PostConstruct
    public void load() {
        names = universityRepository.findAllNames().stream()
                .collect(Collectors.toUnmodifiableMap(UnivName::id, UnivName::name));
    }

    public String getName(Long universityId) {
        String name = names.get(universityId);
        if (name == null) throw new BusinessException(ErrorCode.UNIV_NOT_FOUND);
        return name;
    }
}
