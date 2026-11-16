package com.back.nbe1214finalsour.domain.alliance.service;

import com.back.nbe1214finalsour.domain.alliance.entity.*;
import com.back.nbe1214finalsour.domain.alliance.repository.*;
import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.domain.user.entity.UserStatus;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AllianceMatchCompletionTest {
    @Mock AllianceRepository allianceRepository;
    @Mock AllianceUniversityRepository allianceUniversityRepository;
    @Mock AllianceMatchRepository allianceMatchRepository;
    @Mock UserRepository userRepository;
    @InjectMocks AllianceMatchService service;

    @Test
    void alreadyInProgress_returnsInvalidInputBeforeCheckingActiveAlliances() {
        OffsetDateTime now = OffsetDateTime.now();
        AllianceMatch match = AllianceMatch.request(10L, 20L, 6, now.plusHours(12));
        match.accept(now.minusMinutes(1));
        User user = mock(User.class);
        when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        when(allianceMatchRepository.findById(50L)).thenReturn(Optional.of(match));
        when(allianceMatchRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(match));
        when(allianceRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(mock(Alliance.class)));
        when(allianceRepository.findByIdForUpdate(20L)).thenReturn(Optional.of(mock(Alliance.class)));
        assertThatThrownBy(() -> service.acceptMatch(3L, 50L))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.COMMON_INVALID_INPUT));
    }

    @Test
    void cancelRequested_byMember() {
        OffsetDateTime now = OffsetDateTime.now();
        AllianceMatch match = AllianceMatch.request(10L, 20L, 6, now.plusHours(12));
        User user = mock(User.class);
        when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(user.getUniversityId()).thenReturn(100L);
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        when(allianceMatchRepository.findById(50L)).thenReturn(Optional.of(match));
        when(allianceMatchRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(match));
        when(allianceRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(mock(Alliance.class)));
        when(allianceRepository.findByIdForUpdate(20L)).thenReturn(Optional.of(mock(Alliance.class)));
        when(allianceUniversityRepository.findByAllianceIdAndStatusAndDeletedAtIsNullOrderByIdAsc(
                10L, AllianceUniversityStatus.ACCEPTED))
                .thenReturn(List.of(AllianceUniversity.createFounder(10L, 100L, 3L)));
        service.cancelMatch(3L, 50L);
        assertThat(match.getStatus()).isEqualTo(AllianceMatchStatus.CANCELED);
    }

    @Test
    void expiredPendingRequest_isCanceled() {
        OffsetDateTime now = OffsetDateTime.now();
        AllianceMatch match = AllianceMatch.request(10L, 20L, 6, now.minusMinutes(1));
        when(allianceMatchRepository.findById(50L)).thenReturn(Optional.of(match));
        when(allianceMatchRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(match));
        when(allianceRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(mock(Alliance.class)));
        when(allianceRepository.findByIdForUpdate(20L)).thenReturn(Optional.of(mock(Alliance.class)));
        service.cancelExpiredRequest(50L);
        assertThat(match.getStatus()).isEqualTo(AllianceMatchStatus.CANCELED);
    }
}
