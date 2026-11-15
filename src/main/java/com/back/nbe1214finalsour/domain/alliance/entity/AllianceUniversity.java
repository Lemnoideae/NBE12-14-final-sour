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
@Table(name = "alliance_university")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AllianceUniversity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "alliance_id", nullable = false)
    private Long allianceId;

    @Column(name = "university_id", nullable = false)
    private Long universityId;

    @Column(name = "applicant_user_id", nullable = false)
    private Long applicantUserId;

    @Column(name = "approver_user_id")
    private Long approverUserId;

    @Column(name = "total_score", nullable = false)
    private Long totalScore = 0L;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private AllianceUniversityStatus status;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    public static AllianceUniversity createFounder(
            Long allianceId,
            Long universityId,
            Long userId
    ) {
        if (allianceId == null || universityId == null || userId == null) {
            throw new IllegalArgumentException(
                    "연합, 학교, 사용자 ID는 필수입니다."
            );
        }

        AllianceUniversity member = new AllianceUniversity();
        member.allianceId = allianceId;
        member.universityId = universityId;
        member.applicantUserId = userId;
        member.approverUserId = userId;
        member.totalScore = 0L;
        member.status = AllianceUniversityStatus.ACCEPTED;

        return member;
    }
}