package com.back.nbe1214finalsour.domain.guestbook.service;

import com.back.nbe1214finalsour.domain.guestbook.dto.GuestBookLikeResponse;
import com.back.nbe1214finalsour.domain.guestbook.repository.GuestBookLikeJdbcRepository;
import com.back.nbe1214finalsour.domain.guestbook.repository.GuestBookRepository;
import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.domain.user.entity.UserStatus;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GuestBookLikeService {

    private final GuestBookRepository guestBookRepository;
    private final GuestBookLikeJdbcRepository guestBookLikeJdbcRepository;
    private final UserRepository userRepository;

    /**
     * 한 회원이 한 방명록에 한 번만 좋아요를 누를 수 있다.
     * 복합 PK와 ON CONFLICT로 동시 중복 요청을 409로 돌려주고, INSERT와 카운트 원자적 증가를 한 트랜잭션으로 묶는다.
     */
    @Transactional
    public GuestBookLikeResponse like(Long guestbookId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.USER_SUSPENDED);
        }
        if (!guestBookRepository.existsById(guestbookId)) {
            throw new BusinessException(ErrorCode.GUEST_NOT_FOUND);
        }

        // insert가 0이면 이미 눌러둔 좋아요다. 카운트를 건드리지 않는다.
        if (guestBookLikeJdbcRepository.insertIfAbsent(guestbookId, userId) == 0) {
            throw new BusinessException(ErrorCode.GUEST_ALREADY_LIKED);
        }

        // 카운트 UPDATE가 실패하면 INSERT도 함께 롤백된다.
        int likeCount = guestBookLikeJdbcRepository.incrementLikeCount(guestbookId);
        return new GuestBookLikeResponse(guestbookId, true, likeCount);
    }
}
