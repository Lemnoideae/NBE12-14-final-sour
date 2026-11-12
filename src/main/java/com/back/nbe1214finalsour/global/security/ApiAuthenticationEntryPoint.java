package com.back.nbe1214finalsour.global.security;

import com.back.nbe1214finalsour.global.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

/** 인증이 필요한데 인증 정보가 없을 때 401 {@code COMMON_UNAUTHORIZED}로 응답한다. */
@Component
@RequiredArgsConstructor
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ApiResponseWriter apiResponseWriter;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        apiResponseWriter.write(response, ErrorCode.COMMON_UNAUTHORIZED);
    }
}
