package com.back.nbe1214finalsour.global.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import java.time.OffsetDateTime;
import lombok.Getter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * {@code created_at}·{@code updated_at} 열이 있는 엔티티의 공통 부모.
 *
 * <p>PostgreSQL에는 MySQL의 {@code ON UPDATE CURRENT_TIMESTAMP}가 없어 {@code updated_at}은 애플리케이션이 채운다.
 * 열이 {@code TIMESTAMPTZ}이고 응답 시각도 오프셋을 포함하므로(API 명세서 §1) {@link OffsetDateTime}을 쓴다.
 * {@code id}와 {@code deleted_at}은 테이블마다 달라(복합 키, 일부만 soft delete) 넣지 않는다.
 */
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseTimeEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
