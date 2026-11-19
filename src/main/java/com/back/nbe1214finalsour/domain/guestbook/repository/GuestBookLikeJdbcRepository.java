package com.back.nbe1214finalsour.domain.guestbook.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class GuestBookLikeJdbcRepository {

    private final JdbcTemplate jdbcTemplate;

    /** PostgreSQL 복합 PK 충돌이면 아무것도 삽입하지 않고 0을 반환한다. */
    public int insertIfAbsent(Long guestbookId, Long userId) {
        return jdbcTemplate.update("""
                INSERT INTO guest_book_like (guest_book_id, user_id)
                VALUES (?, ?)
                ON CONFLICT ON CONSTRAINT pk_guest_book_like DO NOTHING
                """, guestbookId, userId);
    }

    /** DB에서 +1을 원자적으로 실행하고 그 결과를 읽는다. updated_at은 DB 트리거가 처리한다. */
    public int incrementLikeCount(Long guestbookId) {
        return jdbcTemplate.queryForObject("""
                UPDATE guest_book
                   SET like_count = like_count + 1
                 WHERE id = ?
                RETURNING like_count
                """, Integer.class, guestbookId);
    }
}
