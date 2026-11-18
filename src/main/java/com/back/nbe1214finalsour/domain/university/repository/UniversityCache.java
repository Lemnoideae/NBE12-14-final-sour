package com.back.nbe1214finalsour.domain.university.repository;

import com.back.nbe1214finalsour.domain.university.dto.LibraryLocation;
import com.back.nbe1214finalsour.domain.university.repository.projections.UnivCacheRow;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class UniversityCache {

    private final UniversityRepository universityRepository;
    private volatile Map<Long, Entry> universities = Map.of();

    @PostConstruct
    public void load() {
        universities = universityRepository.findAllForCache().stream()
                .collect(Collectors.toUnmodifiableMap(UnivCacheRow::id, Entry::from));
    }

    public String getName(Long universityId) {
        return find(universityId).name();
    }

    public Optional<LibraryLocation> getLibrary(Long universityId) {
        return Optional.ofNullable(find(universityId).library());
    }

    private Entry find(Long universityId) {
        Entry entry = universities.get(universityId);
        if (entry == null) throw new BusinessException(ErrorCode.UNIV_NOT_FOUND);
        return entry;
    }

    private record Entry(String name, LibraryLocation library) {
        static Entry from(UnivCacheRow row) {
            LibraryLocation library = (row.libraryLat() == null || row.libraryLng() == null)
                    ? null : new LibraryLocation(row.libraryLat().doubleValue(), row.libraryLng().doubleValue());
            return new Entry(row.name(), library);
        }
    }
}
