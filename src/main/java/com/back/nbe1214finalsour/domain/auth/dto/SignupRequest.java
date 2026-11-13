package com.back.nbe1214finalsour.domain.auth.dto;

import com.back.nbe1214finalsour.domain.user.validation.Nickname;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/v1/auth/signup} 요청. 학교는 받지 않고 가입 토큰의 이메일 도메인으로 서버가 정한다.
 *
 * @param password 8~64자, 공백 없는 ASCII 문자만, 영문·숫자·특수문자를 각각 하나 이상.
 *                 ASCII로 제한해 BCrypt 입력 한도(72바이트)를 넘지 않게 한다
 */
public record SignupRequest(
        @NotBlank @Size(max = 64) String signupToken,
        @Nickname String nickname,
        @NotNull
        @Pattern(regexp = PASSWORD_REGEX, message = "비밀번호는 공백 없이 8~64자이고 영문·숫자·특수문자를 모두 포함해야 합니다.")
        String password,
        @NotNull @Positive Long departmentId) {

    static final String PASSWORD_REGEX = "(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9])[\\x21-\\x7E]{8,64}";

    /** 로그에 비밀번호가 남지 않도록 가린다 */
    @Override
    public String toString() {
        return "SignupRequest[signupToken=***, nickname=" + nickname + ", password=***, departmentId=" + departmentId + "]";
    }
}
