package com.back.nbe1214finalsour.domain.auth.service;

import com.back.nbe1214finalsour.domain.auth.dto.LoginResponse;
import com.back.nbe1214finalsour.domain.auth.dto.LoginResponse.LoginUser;
import com.back.nbe1214finalsour.domain.auth.repository.LoginAttemptStore;
import com.back.nbe1214finalsour.domain.user.entity.User;
import com.back.nbe1214finalsour.domain.user.entity.UserStatus;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.global.crypto.EmailHasher;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import com.back.nbe1214finalsour.global.security.AuthUser;
import com.back.nbe1214finalsour.global.security.jwt.JwtProvider;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 이메일·비밀번호 로그인 (API 명세서 {@code POST /api/auth/login}).
 *
 * <ol>
 *   <li>잠금 확인과 시도 횟수 증가 ({@link LoginAttemptStore}). 잠겼으면 429</li>
 *   <li>탈퇴하지 않은 회원을 이메일 해시로 찾고 비밀번호 확인. 회원이 없거나 틀리면 401이고, 5번째 실패면 잠그고 429</li>
 *   <li>비밀번호가 맞으면 실패 횟수를 지운 뒤 상태 확인. 정지·차단이면 403</li>
 *   <li>access 토큰과 refresh 토큰 발급</li>
 * </ol>
 *
 * <p>상태(정지·차단)는 비밀번호가 맞을 때만 알려준다. 틀린 비밀번호로 계정 상태를 알아낼 수 없게 하기 위함이다.
 */
@Service
public class LoginService {

    static final int MAX_FAILURES = 5;
    static final Duration FAILURE_WINDOW = Duration.ofMinutes(10);
    static final Duration LOCK_DURATION = Duration.ofMinutes(10);

    private final UserRepository userRepository;
    private final EmailHasher emailHasher;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptStore loginAttemptStore;
    private final JwtProvider jwtProvider;
    private final RefreshTokenService refreshTokenService;

    /**
     * 없는 이메일일 때도 비밀번호 확인을 한 번 해서 응답 시간으로 가입 여부가 드러나지 않게 한다.
     * 값은 아무 비밀번호와도 맞지 않는 임의 문자열의 해시다.
     */
    private final String dummyPasswordHash;

    public LoginService(UserRepository userRepository, EmailHasher emailHasher, PasswordEncoder passwordEncoder,
            LoginAttemptStore loginAttemptStore, JwtProvider jwtProvider, RefreshTokenService refreshTokenService) {
        this.userRepository = userRepository;
        this.emailHasher = emailHasher;
        this.passwordEncoder = passwordEncoder;
        this.loginAttemptStore = loginAttemptStore;
        this.jwtProvider = jwtProvider;
        this.refreshTokenService = refreshTokenService;
        this.dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /**
     * @throws BusinessException 429 {@code AUTH_LOGIN_LOCKED}, 401 {@code AUTH_INVALID_CREDENTIALS},
     *                           403 {@code USER_SUSPENDED}
     */
    public LoginResult login(String email, String password) {
        String emailHash = emailHasher.hash(email);
        long attempt = loginAttemptStore.tryAcquire(emailHash, MAX_FAILURES, FAILURE_WINDOW);
        if (attempt < 0) {
            throw new BusinessException(ErrorCode.AUTH_LOGIN_LOCKED);
        }

        Optional<User> found = userRepository.findByEmailHashAndDeletedAtIsNull(emailHash);
        String encodedPassword = found.map(User::getPassword).orElse(dummyPasswordHash);
        boolean matches = passwordEncoder.matches(password, encodedPassword) && found.isPresent();
        if (!matches) {
            if (attempt >= MAX_FAILURES) {
                loginAttemptStore.lock(emailHash, LOCK_DURATION);
                throw new BusinessException(ErrorCode.AUTH_LOGIN_LOCKED, "로그인 " + attempt + "번째 실패로 잠금");
            }
            throw new BusinessException(ErrorCode.AUTH_INVALID_CREDENTIALS, "로그인 " + attempt + "번째 실패");
        }
        loginAttemptStore.reset(emailHash);

        User user = found.get();
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.USER_SUSPENDED,
                    "로그인 거부: userId=" + user.getId() + ", status=" + user.getStatus());
        }

        AuthUser authUser = new AuthUser(user.getId(), user.getUniversityId(), user.getRole());
        LoginResponse response = new LoginResponse(jwtProvider.createAccessToken(authUser),
                jwtProvider.accessTokenExpiresInSeconds(), LoginUser.from(user));
        return new LoginResult(response, refreshTokenService.issue(user.getId()), jwtProvider.refreshTokenTtl());
    }

    /**
     * @param refreshToken    refresh 토큰 원문. 쿠키로만 보낸다
     * @param refreshTokenTtl 쿠키 {@code Max-Age}
     */
    public record LoginResult(LoginResponse response, String refreshToken, Duration refreshTokenTtl) {

        /** 토큰이 로그에 남지 않도록 가린다 */
        @Override
        public String toString() {
            return "LoginResult[userId=" + response.user().id() + ", tokens=****]";
        }
    }
}
