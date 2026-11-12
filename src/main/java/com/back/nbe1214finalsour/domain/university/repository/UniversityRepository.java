package com.back.nbe1214finalsour.domain.university.repository;

import com.back.nbe1214finalsour.domain.university.entity.University;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UniversityRepository extends JpaRepository<University, Long> {

    Optional<University> findByName(String name);
    boolean existsByName(String name);
}
