package com.back.nbe1214finalsour.domain.chat.dto;

import com.back.nbe1214finalsour.domain.chat.entity.ChatMessage;
import com.back.nbe1214finalsour.global.time.ClockConfig;
import java.time.OffsetDateTime;

/**
 * 구독자가 받는 채팅 메시지 (계획 §3-2, 명세서 §3-7). Redis 채널로 서버 간에 전달하는 본문도 같은 형식이다.
 *
 * @param createdAt 서버 시각. 한국 시간 오프셋({@code +09:00})으로 나간다
 */
public record ChatMessageResponse(
        String messageId,
        String roomId,
        Long userId,
        String nickname,
        String universityName,
        String content,
        OffsetDateTime createdAt
) {

    public static ChatMessageResponse from(ChatMessage message) {
        return new ChatMessageResponse(
                message.getMessageId(),
                message.getRoomId(),
                message.getUserId(),
                message.getNickname(),
                message.getUniversityName(),
                message.getContent(),
                message.getCreatedAt().atZone(ClockConfig.KST).toOffsetDateTime());
    }
}
