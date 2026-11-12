package com.back.nbe1214finalsour.global.security.jwt;

import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.security.AuthUser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * {@code Authorization: Bearer <access 토큰>}을 검증해 {@link AuthUser}를 SecurityContext에 넣는다.
 *
 * <p>토큰이 없거나 틀려도 요청을 막지 않고 익명으로 넘긴다. 인증 "선택" API는 오래된 토큰이 붙어 와도 동작해야 하기 때문이다
 * (회원·인증 계획 Q4). 토큰이 틀린 사유({@code COMMON_EXPIRED_TOKEN}·{@code COMMON_INVALID_TOKEN})는 요청 속성
 * {@link #TOKEN_ERROR_ATTRIBUTE}에 남기고, 보호 경로에서 401을 낼 때 entry point가 이 값으로 코드를 고른다.
 *
 * <p>빈으로 등록하지 않는다. 빈이면 Spring Boot가 서블릿 필터로도 등록해 Security 필터 체인 밖에서 한 번 더 돈다.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** 토큰 검증 실패 사유({@link com.back.nbe1214finalsour.global.exception.ErrorCode})를 담는 요청 속성 이름. */
    public static final String TOKEN_ERROR_ATTRIBUTE = JwtAuthenticationFilter.class.getName() + ".TOKEN_ERROR";

    private static final String BEARER_PREFIX = "Bearer ";
    private static final String ROLE_PREFIX = "ROLE_";

    private final JwtProvider jwtProvider;
    private final SecurityContextHolderStrategy securityContextHolderStrategy =
            SecurityContextHolder.getContextHolderStrategy();

    public JwtAuthenticationFilter(JwtProvider jwtProvider) {
        this.jwtProvider = jwtProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            authenticate(request, header.substring(BEARER_PREFIX.length()).trim());
        }
        chain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest request, String token) {
        try {
            AuthUser authUser = jwtProvider.parseAccessToken(token);
            var authentication = UsernamePasswordAuthenticationToken.authenticated(
                    authUser, null, List.of(new SimpleGrantedAuthority(ROLE_PREFIX + authUser.role().name())));
            SecurityContext context = securityContextHolderStrategy.createEmptyContext();
            context.setAuthentication(authentication);
            securityContextHolderStrategy.setContext(context);
        } catch (BusinessException e) {
            request.setAttribute(TOKEN_ERROR_ATTRIBUTE, e.getErrorCode());
        }
    }
}
