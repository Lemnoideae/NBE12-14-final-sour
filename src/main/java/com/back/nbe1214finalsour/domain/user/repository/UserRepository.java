package com.back.nbe1214finalsour.domain.user.repository;

import com.back.nbe1214finalsour.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    /** 탈퇴하지 않은 회원 중에 이 이메일 해시가 있는지. {@code uk_users_email_hash}와 같은 조건이다 */
    boolean existsByEmailHashAndDeletedAtIsNull(String emailHash);

    /**
     * 탈퇴하지 않은 회원 중에 대소문자만 다른 닉네임까지 같은 닉네임이 있는지.
     * {@code uk_users_nickname_ci}(lower(nickname))와 같은 기준이 되도록 {@code lower}로 비교한다
     * (Spring Data의 {@code IgnoreCase}는 {@code upper}를 쓴다)
     */
    @Query("select count(u) > 0 from User u where lower(u.nickname) = lower(:nickname) and u.deletedAt is null")
    boolean existsActiveNicknameIgnoreCase(@Param("nickname") String nickname);
}
