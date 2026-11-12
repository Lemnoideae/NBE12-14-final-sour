package com.back.nbe1214finalsour.domain.university.repository;

import com.back.nbe1214finalsour.domain.university.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DepartmentRepository extends JpaRepository<Department, Long> {

    List<Department> findByUniversity_IdOrderByNameAsc(Long universityId);
    boolean existsByUniversity_IdAndName(Long universityId, String name);
}
