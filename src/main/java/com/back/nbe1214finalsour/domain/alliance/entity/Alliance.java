package com.back.nbe1214finalsour.domain.alliance.entity;

import com.back.nbe1214finalsour.global.jpa.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Entity
@Table(name = "alliance")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Alliance extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "total_score", nullable = false)
    private Long totalScore = 0L;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private AllianceStatus status;

    @Column(name = "duration_hours", nullable = false, updatable = false)
    private Integer durationHours;

    @Column(name = "expired_at", nullable = false, updatable = false)
    private OffsetDateTime expiredAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    public static Alliance create(String name, int durationHours, OffsetDateTime now) {
        if (name == null || name.isBlank() || name.trim().length() > 50) {
            throw new IllegalArgumentException("연합 이름은 1~50자여야 합니다.");
        }

        if (durationHours < 6 || durationHours > 72) {
            throw new IllegalArgumentException("연합 유지 시간은 6~72시간이어야 합니다.");
        }

        if (now == null) {
            throw new IllegalArgumentException("현재 시각은 필수입니다.");
        }

        Alliance alliance = new Alliance();
        alliance.name = name.trim();
        alliance.totalScore = 0L;
        alliance.status = AllianceStatus.ACTIVE;
        alliance.durationHours = durationHours;
        alliance.expiredAt = now.plusHours(durationHours);

        return alliance;
    }
}
