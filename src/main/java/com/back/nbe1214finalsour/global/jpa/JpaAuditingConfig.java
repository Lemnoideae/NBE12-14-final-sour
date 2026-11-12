package com.back.nbe1214finalsour.global.jpa;

import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * {@link BaseTimeEntity}의 시각을 채운다.
 *
 * <p>메인 클래스가 아니라 여기에 두는 이유: 메인 클래스에 두면 {@code @WebMvcTest} 같은 슬라이스 테스트가 JPA 설정을 찾다가 실패한다.
 * Spring Data 기본 시각 제공자는 시간대 없는 {@code LocalDateTime}을 주므로, 오프셋을 포함한 {@link OffsetDateTime}을 주는 제공자를 쓴다.
 */
@Configuration
@EnableJpaAuditing(dateTimeProviderRef = "auditingDateTimeProvider")
public class JpaAuditingConfig {

    @Bean
    public DateTimeProvider auditingDateTimeProvider() {
        return () -> Optional.of(OffsetDateTime.now());
    }
}
