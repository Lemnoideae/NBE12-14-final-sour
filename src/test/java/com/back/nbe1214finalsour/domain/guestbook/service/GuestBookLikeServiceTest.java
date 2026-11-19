package com.back.nbe1214finalsour.domain.guestbook.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.back.nbe1214finalsour.domain.guestbook.dto.GuestBookLikeResponse;
import com.back.nbe1214finalsour.domain.guestbook.repository.GuestBookLikeJdbcRepository;
import com.back.nbe1214finalsour.domain.guestbook.repository.GuestBookRepository;
import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.domain.user.entity.UserStatus;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GuestBookLikeServiceTest {
    @Mock GuestBookRepository guestBookRepository;
    @Mock GuestBookLikeJdbcRepository likeRepository;
    @Mock UserRepository userRepository;
    @Mock User user;
    @InjectMocks GuestBookLikeService service;

    private void givenActiveUser() {
        given(userRepository.findById(7L)).willReturn(Optional.of(user));
        given(user.getStatus()).willReturn(UserStatus.ACTIVE);
    }

    @Test
    void like_addsOnceAndReturnsNewCount() {
        givenActiveUser();
        given(guestBookRepository.existsById(10L)).willReturn(true);
        given(likeRepository.insertIfAbsent(10L, 7L)).willReturn(1);
        given(likeRepository.incrementLikeCount(10L)).willReturn(13);

        GuestBookLikeResponse response = service.like(10L, 7L);

        assertThat(response.guestbookId()).isEqualTo(10L);
        assertThat(response.liked()).isTrue();
        assertThat(response.likeCount()).isEqualTo(13);
        verify(likeRepository).incrementLikeCount(10L);
    }

    @Test
    void duplicateLike_throws409AndDoesNotIncrement() {
        givenActiveUser();
        given(guestBookRepository.existsById(10L)).willReturn(true);
        given(likeRepository.insertIfAbsent(10L, 7L)).willReturn(0);

        assertError(ErrorCode.GUEST_ALREADY_LIKED, () -> service.like(10L, 7L));
        verify(likeRepository, never()).incrementLikeCount(10L);
    }

    @Test
    void nonexistentGuestbook_throws404WithoutInserting() {
        givenActiveUser();
        assertError(ErrorCode.GUEST_NOT_FOUND, () -> service.like(999L, 7L));
        verifyNoInteractions(likeRepository);
    }

    @Test
    void missingUser_isRejectedBeforeDatabaseWrite() {
        assertError(ErrorCode.USER_NOT_FOUND, () -> service.like(10L, 7L));
        verifyNoInteractions(likeRepository, guestBookRepository);
    }

    @Test
    void suspendedUser_isRejectedBeforeDatabaseWrite() {
        given(userRepository.findById(7L)).willReturn(Optional.of(user));
        given(user.getStatus()).willReturn(UserStatus.SUSPENDED);
        assertError(ErrorCode.USER_SUSPENDED, () -> service.like(10L, 7L));
        verifyNoInteractions(likeRepository, guestBookRepository);
    }

    private static void assertError(ErrorCode code, Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(code));
    }
}
