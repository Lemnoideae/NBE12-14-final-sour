package com.back.nbe1214finalsour.domain.university.repository;

import com.back.nbe1214finalsour.domain.university.entity.University;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UniversityRepository extends JpaRepository<University, Long> {

    Optional<University> findByName(String name);
    boolean existsByName(String name);
    // 학교 이름 부분 검색 + 이름순 정렬
    List<University> findByNameContainingIgnoreCaseOrderByNameAsc(String keyword,  Pageable pageable);
}
