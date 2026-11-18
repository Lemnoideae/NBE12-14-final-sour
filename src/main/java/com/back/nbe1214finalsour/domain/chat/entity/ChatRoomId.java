package com.back.nbe1214finalsour.domain.chat.entity;

/**
 * 채팅방 ID. DynamoDB {@code chat_message} 테이블의 파티션 키({@code room_id}) 값이다.
 *
 * <p>학교 방은 {@code UNIV#{학교 ID}}다. 연합 방({@code ALLIANCE#{연합 ID}})은 채팅 2단계에서 추가한다.
 */
public final class ChatRoomId {

    private static final String UNIVERSITY_PREFIX = "UNIV#";

    private ChatRoomId() {
    }

    public static String university(long universityId) {
        return UNIVERSITY_PREFIX + universityId;
    }
}
