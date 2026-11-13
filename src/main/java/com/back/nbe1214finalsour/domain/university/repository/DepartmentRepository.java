package com.back.nbe1214finalsour.domain.university.repository;

import com.back.nbe1214finalsour.domain.university.entity.Department;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface DepartmentRepository extends JpaRepository<Department, Long> {

    List<Department> findByUniversity_IdOrderByNameAsc(Long universityId);
    boolean existsByUniversity_IdAndName(Long universityId, String name);
    // 특정 학교에서 누적 점수가 높은 학과부터 조회
    List<Department> findByUniversity_IdOrderByTotalScoreDescIdAsc(
            Long universityId,
            Pageable pageable
    );
    // 해당 학교에 소속되어 있으면서 지정한 ID에 해당하는 학과들만 조회
    List<Department> findByUniversity_IdAndIdIn(
            Long universityId,
            Collection<Long> departmentIds
    );
}
