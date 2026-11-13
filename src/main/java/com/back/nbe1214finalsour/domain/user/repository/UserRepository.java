package com.back.nbe1214finalsour.domain.user.repository;

import com.back.nbe1214finalsour.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    /** 탈퇴하지 않은 회원 중에 이 이메일 해시가 있는지. {@code uk_users_email_hash}와 같은 조건이다 */
    boolean existsByEmailHashAndDeletedAtIsNull(String emailHash);
}
