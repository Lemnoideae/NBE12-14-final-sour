package com.back.nbe1214finalsour.domain.chat.repository;

import com.back.nbe1214finalsour.domain.chat.entity.ChatMessage;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByChatRoomIdOrderByIdDesc(Long roomId, Pageable page);
    List<ChatMessage> findByChatRoomIdAndIdLessThanOrderByIdDesc(Long roomId, Long cursor, Pageable page);
    List<ChatMessage> findByAllianceChatRoomIdOrderByIdDesc(Long roomId, Pageable page);
    List<ChatMessage> findByAllianceChatRoomIdAndIdLessThanOrderByIdDesc(Long roomId, Long cursor, Pageable page);
}
