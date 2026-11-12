package com.back.nbe1214finalsour.global.jpa;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.nbe1214finalsour.IntegrationTest;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@link BaseTimeEntity}가 저장·수정 시각을 애플리케이션에서 채우는지 PostgreSQL로 확인한다.
 * PostgreSQL에는 MySQL의 {@code ON UPDATE CURRENT_TIMESTAMP}가 없어 {@code updated_at}은 애플리케이션이 바꿔야 한다.
 *
 * <p>테스트 전용 테이블을 만들지 않으려고 {@code created_at}·{@code updated_at}이 있는 {@code clicker} 테이블을 빌려 쓴다.
 * 테스트 트랜잭션이 끝나면 롤백된다.
 */
@IntegrationTest
@Transactional
class BaseTimeEntityTest {

    private static final long PROBE_ID = 9_001L;

    @Autowired
    private EntityManager entityManager;

    @Test
    @DisplayName("저장하면 createdAt·updatedAt이 현재 시각으로 채워진다")
    void fillsTimestampsOnPersist() {
        OffsetDateTime before = OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS);

        entityManager.persist(new TimeProbe(PROBE_ID, 1));
        entityManager.flush();
        entityManager.clear();

        TimeProbe saved = entityManager.find(TimeProbe.class, PROBE_ID);
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getCreatedAt().toInstant()).isAfterOrEqualTo(before.toInstant());
        assertThat(saved.getUpdatedAt().toInstant()).isEqualTo(saved.getCreatedAt().toInstant());
    }

    @Test
    @DisplayName("수정하면 updatedAt만 바뀌고 createdAt은 그대로다")
    void updatesOnlyUpdatedAt() throws InterruptedException {
        entityManager.persist(new TimeProbe(PROBE_ID, 1));
        entityManager.flush();
        entityManager.clear();
        TimeProbe saved = entityManager.find(TimeProbe.class, PROBE_ID);
        OffsetDateTime createdAt = saved.getCreatedAt();
        OffsetDateTime firstUpdatedAt = saved.getUpdatedAt();

        Thread.sleep(5); // DB 정밀도(마이크로초)보다 확실히 늦은 시각으로 수정한다
        saved.changeClickPower(2);
        entityManager.flush();
        entityManager.clear();

        TimeProbe updated = entityManager.find(TimeProbe.class, PROBE_ID);
        assertThat(updated.getCreatedAt().toInstant()).isEqualTo(createdAt.toInstant());
        assertThat(updated.getUpdatedAt().toInstant()).isAfter(firstUpdatedAt.toInstant());
    }

    @Entity(name = "BaseTimeEntityTestProbe")
    @Table(name = "clicker")
    static class TimeProbe extends BaseTimeEntity {

        @Id
        private Long id;

        private int clickPower;

        protected TimeProbe() {
        }

        TimeProbe(Long id, int clickPower) {
            this.id = id;
            this.clickPower = clickPower;
        }

        void changeClickPower(int clickPower) {
            this.clickPower = clickPower;
        }
    }
}
