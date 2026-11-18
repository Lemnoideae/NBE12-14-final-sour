package com.back.nbe1214finalsour.domain.chat.relay;

import com.back.nbe1214finalsour.domain.chat.dto.ChatMessageResponse;
import com.back.nbe1214finalsour.domain.chat.entity.ChatRoomId;
import com.back.nbe1214finalsour.domain.chat.websocket.ChatDestinations;
import com.back.nbe1214finalsour.global.redis.RedisKey;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Redis 채널 {@code chat:univ:*}(패턴 구독, D5)로 온 메시지를 이 서버의 STOMP 구독자에게 보낸다
 * ({@code /topic/chat/universities/{학교 ID}}).
 *
 * <p>채널 이름이나 본문이 형식에 맞지 않으면 보내지 않고 경고 로그만 남긴다. 다른 메시지 처리에는 영향이 없다.
 */
@Slf4j
@Component
public class ChatRedisSubscriber implements MessageListener {

    /** {@link RedisKey#CHAT_UNIV_CHANNEL}({@code chat:univ:%s})의 모든 학교 채널 */
    public static final String UNIVERSITY_CHANNEL_PATTERN = RedisKey.CHAT_UNIV_CHANNEL.pattern().formatted("*");

    private static final Pattern UNIVERSITY_CHANNEL = Pattern.compile(
            "^" + Pattern.quote(RedisKey.CHAT_UNIV_CHANNEL.pattern().formatted("")) + "(\\d{1,18})$");

    private final SimpMessagingTemplate messagingTemplate;
    private final JsonMapper jsonMapper;

    public ChatRedisSubscriber(SimpMessagingTemplate messagingTemplate, JsonMapper jsonMapper) {
        this.messagingTemplate = messagingTemplate;
        this.jsonMapper = jsonMapper;
    }

    @Override
    public void onMessage(Message message, byte @Nullable [] pattern) {
        String channel = new String(message.getChannel(), StandardCharsets.UTF_8);
        Matcher matcher = UNIVERSITY_CHANNEL.matcher(channel);
        if (!matcher.matches()) {
            log.warn("형식에 맞지 않는 채팅 채널이라 버림 channel={}", channel);
            return;
        }
        long universityId = Long.parseLong(matcher.group(1));

        ChatMessageResponse response;
        try {
            response = this.jsonMapper.readValue(message.getBody(), ChatMessageResponse.class);
        } catch (JacksonException e) {
            log.warn("채팅 메시지 본문을 읽지 못해 버림 channel={}", channel, e);
            return;
        }
        // 다른 방의 메시지가 잘못 발행돼도 이 방 구독자에게 보내지 않는다
        if (!ChatRoomId.university(universityId).equals(response.roomId())) {
            log.warn("채널과 방이 달라 버림 channel={} roomId={} messageId={}", channel, response.roomId(),
                    response.messageId());
            return;
        }

        this.messagingTemplate.convertAndSend(ChatDestinations.university(universityId), response);
    }
}
