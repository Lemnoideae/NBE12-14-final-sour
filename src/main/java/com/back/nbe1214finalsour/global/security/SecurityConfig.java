package com.back.nbe1214finalsour.global.security;

import com.back.nbe1214finalsour.global.security.jwt.JwtAuthenticationFilter;
import com.back.nbe1214finalsour.global.security.jwt.JwtProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Security 설정. 요청마다 {@link JwtAuthenticationFilter}가 access 토큰으로 로그인 사용자를 채운다.
 *
 * <p>401/403은 컨트롤러 밖(필터)에서 결정되므로 {@code GlobalExceptionHandler}가 아니라
 * {@link ApiAuthenticationEntryPoint}와 {@link ApiAccessDeniedHandler}가 {@code ApiResponse}로 응답한다.
 * CORS 규칙은 {@link CorsConfig}에 있다.
 */
@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final ApiAuthenticationEntryPoint authenticationEntryPoint;
    private final ApiAccessDeniedHandler accessDeniedHandler;
    private final JwtProvider jwtProvider;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new JwtAuthenticationFilter(jwtProvider), UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/clickers/upgrade").authenticated()    // 클리커 업그레이드 API
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout").authenticated()  // 로그아웃 (명세서: 인증 필요)
                        .requestMatchers("/error", "/actuator/health").permitAll()
                        // TODO(SCRUM-68): API 명세서의 인증 표기(필요·선택·불필요·관리자)대로 바꾼다.
                        // 그전까지 팀원이 로컬에서 API를 호출할 수 있도록 임시로 모두 허용한다.
                        // 토큰이 유효하면 @AuthenticationPrincipal AuthUser는 지금도 채워진다.
                        .requestMatchers("/api/**").permitAll()
                        .anyRequest().denyAll());
        return http.build();
    }
}
