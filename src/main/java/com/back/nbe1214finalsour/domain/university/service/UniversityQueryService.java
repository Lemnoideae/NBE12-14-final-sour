package com.back.nbe1214finalsour.domain.university.service;

import com.back.nbe1214finalsour.domain.university.dto.DepartmentResponse;
import com.back.nbe1214finalsour.domain.university.dto.UniversitySearchResponse;
import com.back.nbe1214finalsour.domain.university.repository.DepartmentRepository;
import com.back.nbe1214finalsour.domain.university.repository.UniversityRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UniversityQueryService {

    private final UniversityRepository universityRepository;
    private final DepartmentRepository departmentRepository;

    public List<UniversitySearchResponse> searchUniversities(
            String keyword,
            int size
    ) {
        return universityRepository
                .findByNameContainingIgnoreCaseOrderByNameAsc(
                        keyword,
                        PageRequest.of(0, size)
                )
                .stream()
                .map(UniversitySearchResponse::new)
                .toList();
    }

    public List<DepartmentResponse> getDepartments(Long universityId){

        if(!universityRepository.existsById(universityId)){
            throw new BusinessException(ErrorCode.UNIV_NOT_FOUND);
        }
        return departmentRepository
                .findByUniversity_IdOrderByNameAsc(universityId)
                .stream()
                .map(DepartmentResponse::new)
                .toList();
    }
}

