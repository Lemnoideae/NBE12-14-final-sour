package com.back.nbe1214finalsour.domain.chat.repository;

import com.back.nbe1214finalsour.domain.chat.entity.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
}
