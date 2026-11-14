package com.back.nbe1214finalsour.domain.user.controller;

import com.back.nbe1214finalsour.domain.auth.controller.RefreshTokenCookies;
import com.back.nbe1214finalsour.domain.user.dto.ChangePasswordRequest;
import com.back.nbe1214finalsour.domain.user.dto.MyInfoResponse;
import com.back.nbe1214finalsour.domain.user.dto.NicknameAvailabilityResponse;
import com.back.nbe1214finalsour.domain.user.dto.UpdateProfileRequest;
import com.back.nbe1214finalsour.domain.user.dto.WithdrawalRequest;
import com.back.nbe1214finalsour.domain.user.service.UserService;
import com.back.nbe1214finalsour.domain.user.validation.Nickname;
import com.back.nbe1214finalsour.global.response.ApiResponse;
import com.back.nbe1214finalsour.global.security.AuthUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    /** 인증 불필요. 닉네임 규칙에 맞지 않으면 400 {@code COMMON_INVALID_INPUT} */
    @GetMapping("/nickname/availability")
    public ApiResponse<NicknameAvailabilityResponse> checkNickname(@RequestParam @Nickname String nickname) {
        return ApiResponse.ok(new NicknameAvailabilityResponse(userService.isNicknameAvailable(nickname)));
    }

    /** 인증 필요 ({@code SecurityConfig}: 공개 목록에 없는 {@code /api/**}). 토큰이 없으면 401 {@code COMMON_UNAUTHORIZED} */
    @GetMapping("/me")
    public ApiResponse<MyInfoResponse> me(@AuthenticationPrincipal AuthUser authUser) {
        return ApiResponse.ok(userService.getMyInfo(authUser.userId()));
    }

    /**
     * 프로필 수정. 인증 필요. 보낸 필드만 바꾸고 내 정보와 같은 형식으로 응답한다.
     * 닉네임 규칙 위반은 400 {@code COMMON_INVALID_INPUT}
     */
    @PatchMapping("/me")
    public ApiResponse<MyInfoResponse> updateProfile(
            @AuthenticationPrincipal AuthUser authUser,
            @RequestBody @Valid UpdateProfileRequest request) {
        return ApiResponse.ok(userService.updateProfile(authUser.userId(), request.nickname(), request.profileImageUrl()));
    }

    /**
     * 비밀번호 변경. 인증 필요. 모든 refresh 토큰을 지우므로 이 브라우저의 refresh 쿠키도 지운다.
     * 응답은 로그아웃과 같이 본문 없는 204다 (계획 D2).
     */
    @PatchMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal AuthUser authUser,
            @RequestBody @Valid ChangePasswordRequest request) {
        userService.changePassword(authUser.userId(), request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, RefreshTokenCookies.expire().toString())
                .build();
    }

    /** 회원 탈퇴. 인증 필요. 비밀번호 변경과 같이 refresh 토큰을 모두 지우고 쿠키도 지운다. 응답은 본문 없는 204 */
    @PostMapping("/me/withdrawal")
    public ResponseEntity<Void> withdraw(
            @AuthenticationPrincipal AuthUser authUser,
            @RequestBody @Valid WithdrawalRequest request) {
        userService.withdraw(authUser.userId(), request.password());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, RefreshTokenCookies.expire().toString())
                .build();
    }
}
