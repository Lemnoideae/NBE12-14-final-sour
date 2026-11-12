package com.back.nbe1214finalsour.domain.user.repository;

import com.back.nbe1214finalsour.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
}
