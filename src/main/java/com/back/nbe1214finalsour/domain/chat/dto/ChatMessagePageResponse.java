package com.back.nbe1214finalsour.domain.chat.dto;

import com.back.nbe1214finalsour.domain.chat.repository.ChatMessageSlice;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * 이전 메시지 한 페이지 (계획 §3-1, D8). 항목은 구독으로 받는 메시지와 같은 형식이라, 클라이언트는 {@code messageId}로 실시간 메시지와
 * 합치고 중복을 없앤다.
 *
 * @param items      최신순
 * @param nextCursor 다음 요청의 {@code cursor}. 다음 페이지가 없으면 null
 */
public record ChatMessagePageResponse(List<ChatMessageResponse> items, @Nullable String nextCursor, boolean hasNext) {

    public static ChatMessagePageResponse from(ChatMessageSlice slice) {
        return new ChatMessagePageResponse(slice.items().stream().map(ChatMessageResponse::from).toList(),
                slice.nextCursor(), slice.hasNext());
    }
}
