package com.back.nbe1214finalsour.domain.auth.repository;

import com.back.nbe1214finalsour.domain.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
}
