package com.back.nbe1214finalsour.domain.user.controller;

import com.back.nbe1214finalsour.domain.user.dto.NicknameAvailabilityResponse;
import com.back.nbe1214finalsour.domain.user.service.UserService;
import com.back.nbe1214finalsour.domain.user.validation.Nickname;
import com.back.nbe1214finalsour.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
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
}
