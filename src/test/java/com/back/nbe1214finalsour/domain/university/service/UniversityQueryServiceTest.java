
package com.back.nbe1214finalsour.domain.university.service;

import com.back.nbe1214finalsour.domain.university.dto.DepartmentResponse;
import com.back.nbe1214finalsour.domain.university.dto.UniversitySearchResponse;
import com.back.nbe1214finalsour.domain.university.entity.Department;
import com.back.nbe1214finalsour.domain.university.entity.University;
import com.back.nbe1214finalsour.domain.university.repository.DepartmentRepository;
import com.back.nbe1214finalsour.domain.university.repository.UniversityRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class UniversityQueryServiceTest {
    @Mock
    private UniversityRepository universityRepository;

    @InjectMocks
    private UniversityQueryService universityQueryService;

    @Mock
    private DepartmentRepository departmentRepository;

    @Test
    @DisplayName("학교 이름으로 검색하면 DTO 목록을 반환한다")
    void searchUniversities() {

        University university = mock(University.class);

        given(university.getId()).willReturn(12L);
        given(university.getName()).willReturn("서울대학교");

        given(universityRepository.findByNameContainingIgnoreCaseOrderByNameAsc(
                eq("서울"), any(Pageable.class)
        )).willReturn(List.of(university));

        List<UniversitySearchResponse> result =
                universityQueryService.searchUniversities("서울", 20);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(12L);
        assertThat(result.get(0).name()).isEqualTo("서울대학교");
        assertThat(result.get(0).logoUrl()).isNull();

        ArgumentCaptor<Pageable> captor =
                ArgumentCaptor.forClass(Pageable.class);

        verify(universityRepository)
                .findByNameContainingIgnoreCaseOrderByNameAsc(
                        eq("서울"), captor.capture()
                );

        assertThat(captor.getValue().getPageNumber()).isZero();
        assertThat(captor.getValue().getPageSize()).isEqualTo(20);
    }

    @Test
    @DisplayName("검색 결과가 없으면 빈 목록을 반환한다")
    void searchUniversities_empty() {

        given(universityRepository.findByNameContainingIgnoreCaseOrderByNameAsc(
                eq("없는학교"), any(Pageable.class)
        )).willReturn(List.of());

        List<UniversitySearchResponse> result =
                universityQueryService.searchUniversities("없는학교", 20);

        assertThat(result).isEmpty();
    }


    @Test
    @DisplayName("학교 ID로 학과 목록을 조회하면 DTO 목록을 반환한다")
    void getDepartments() {

        Long universityId = 12L;

        Department first = mock(Department.class);
        Department second = mock(Department.class);

        given(first.getId()).willReturn(301L);
        given(first.getName()).willReturn("경영학과");

        given(second.getId()).willReturn(302L);
        given(second.getName()).willReturn("컴퓨터공학과");

        given(universityRepository.existsById(universityId))
                .willReturn(true);
        given(departmentRepository.findByUniversity_IdOrderByNameAsc(universityId))
                .willReturn(List.of(first, second));

        List<DepartmentResponse> result =
                universityQueryService.getDepartments(universityId);

        assertThat(result).hasSize(2);
        assertThat(result)
                .extracting(DepartmentResponse::name)
                .containsExactly("경영학과", "컴퓨터공학과");

        verify(universityRepository).existsById(universityId);
        verify(departmentRepository)
                .findByUniversity_IdOrderByNameAsc(universityId);
    }


    @Test
    @DisplayName("학교는 존재하지만 학과가 없으면 빈 목록 반환")
    void getDepartments_empty(){

        Long universityId = 12L;

        given(universityRepository.existsById(universityId))
                .willReturn(true);

        given(departmentRepository.findByUniversity_IdOrderByNameAsc(universityId))
                .willReturn(List.of());

        List<DepartmentResponse> result =
                universityQueryService.getDepartments(universityId);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("존재하지 않는 학교의 학과를 조회하면 예외가 발생한다")
    void getDepartments_universityNotFound() {

        Long universityId = 999999L;

        given(universityRepository.existsById(universityId))
                .willReturn(false);

        assertThatExceptionOfType(BusinessException.class)
                .isThrownBy(() ->
                        universityQueryService.getDepartments(universityId)
                )
                .satisfies(exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.UNIV_NOT_FOUND)
                );

        verify(universityRepository).existsById(universityId);
    }
}
