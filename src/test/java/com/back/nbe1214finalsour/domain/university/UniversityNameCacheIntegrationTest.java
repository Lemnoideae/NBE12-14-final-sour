package com.back.nbe1214finalsour.domain.university;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.nbe1214finalsour.IntegrationTest;
import com.back.nbe1214finalsour.domain.university.entity.University;
import com.back.nbe1214finalsour.domain.university.repository.UniversityNameCache;
import com.back.nbe1214finalsour.domain.university.repository.UniversityRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 공격·지원 대상 학교의 존재 확인과 이름 조회를 DB 대신 메모리에서 하는 캐시를 확인한다.
 *
 * <p>캐시는 스프링 컨텍스트에서 공유되는 싱글턴이다. 그래서 {@code @Transactional} 롤백을 쓰지 않고,
 * 테스트가 만든 학교는 직접 지운 뒤 캐시를 다시 불러와 다른 테스트에 남지 않게 한다.
 */
@IntegrationTest
class UniversityNameCacheIntegrationTest {

    /** DB에 없는 학교 ID */
    private static final Long UNKNOWN_UNIV_ID = 999_999_999L;

    @Autowired
    private UniversityNameCache universityNameCache;
    @Autowired
    private UniversityRepository universityRepository;

    private final List<Long> createdUnivIds = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        if (!createdUnivIds.isEmpty()) {
            universityRepository.deleteAllById(createdUnivIds);
            universityNameCache.load();
        }
    }

    @Test
    @DisplayName("서버가 뜰 때 시드 학교를 불러 두어 ID로 이름을 돌려준다")
    void returnsNameOfSeededUniversity() {
        // given: V2__seed_universities.sql로 들어간 학교
        Long seoulId = universityRepository.findByName("서울대학교").orElseThrow().getId();

        // when
        String name = universityNameCache.getName(seoulId);

        // then
        assertThat(name).isEqualTo("서울대학교");
    }

    @Test
    @DisplayName("DB의 모든 학교를 캐시에서 찾을 수 있다")
    void containsEveryUniversityInDb() {
        // given
        List<University> universities = universityRepository.findAll();

        // when & then
        assertThat(universities).isNotEmpty();
        assertThat(universities).allSatisfy(university ->
                assertThat(universityNameCache.getName(university.getId())).isEqualTo(university.getName()));
    }

    @Test
    @DisplayName("없는 학교 ID면 UNIV_NOT_FOUND를 던진다")
    void throwsWhenUniversityDoesNotExist() {
        assertThatThrownBy(() -> universityNameCache.getName(UNKNOWN_UNIV_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNIV_NOT_FOUND);
    }

    @Test
    @DisplayName("서버가 뜬 뒤 추가된 학교는 다시 불러오기 전까지 찾지 못한다")
    void findsUniversityAddedAfterStartupOnlyAfterReload() {
        // given
        University added = universityRepository.save(new University("캐시테스트대학교"));
        createdUnivIds.add(added.getId());

        // when & then: 아직 캐시에 없음
        assertThatThrownBy(() -> universityNameCache.getName(added.getId()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNIV_NOT_FOUND);

        // when: 다시 불러오면
        universityNameCache.load();

        // then
        assertThat(universityNameCache.getName(added.getId())).isEqualTo("캐시테스트대학교");
    }
}
