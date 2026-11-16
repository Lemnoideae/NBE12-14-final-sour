package com.back.nbe1214finalsour.domain.support.repository;

import com.back.nbe1214finalsour.domain.support.entity.CustomerSupport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerSupportRepository extends JpaRepository<CustomerSupport, Long> {

    /**
     * 접수 상태인 문의에만 답변을 넣고 {@code ANSWERED}로 바꾼다 (계획 Q5). 두 관리자가 동시에 답변해도 한 건만 1을 받는다.
     * {@code updated_at}은 트리거가 채운다.
     *
     * <p>영속성 컨텍스트를 거치지 않는 벌크 UPDATE라 앞뒤로 flush·clear 한다. 같은 트랜잭션에서 미리 읽은 엔티티가 옛 상태로
     * 남지 않게 하기 위함이다.
     *
     * @return 바뀐 행 수. 0이면 문의가 없거나 이미 답변했다
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update CustomerSupport s
               set s.status = com.back.nbe1214finalsour.domain.support.entity.SupportStatus.ANSWERED,
                   s.answerTitle = :answerTitle,
                   s.answerContent = :answerContent
             where s.id = :id
               and s.status = com.back.nbe1214finalsour.domain.support.entity.SupportStatus.RECEIVED
            """)
    int answer(@Param("id") Long id, @Param("answerTitle") String answerTitle,
               @Param("answerContent") String answerContent);
}
