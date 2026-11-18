package com.back.nbe1214finalsour.domain.chat.service;

import com.back.nbe1214finalsour.domain.chat.dto.ChatMessagePageResponse;
import com.back.nbe1214finalsour.domain.chat.entity.ChatRoomId;
import com.back.nbe1214finalsour.domain.chat.repository.ChatMessageRepository;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

/** 채팅 이전 메시지 조회 (SCRUM-131, 계획 D8) */
@Service
@RequiredArgsConstructor
public class ChatHistoryService {

    /** 한 번에 읽는 개수의 상한이자 기본값 (D8) */
    public static final int MAX_PAGE_SIZE = 20;

    private final ChatMessageRepository chatMessageRepository;

    /**
     * 소속 학교 방만 읽을 수 있다. 소속은 구독 권한과 같이 토큰의 학교 ID로 판단한다.
     *
     * @throws BusinessException {@code CHAT_NOT_MEMBER}
     */
    public ChatMessagePageResponse getUniversityMessages(AuthUser authUser, long universityId, @Nullable String cursor,
                                                         int size) {
        if (authUser.universityId() == null || authUser.universityId() != universityId) {
            throw new BusinessException(ErrorCode.CHAT_NOT_MEMBER);
        }
        return ChatMessagePageResponse.from(
                this.chatMessageRepository.findLatest(ChatRoomId.university(universityId), cursor, size));
    }
}
