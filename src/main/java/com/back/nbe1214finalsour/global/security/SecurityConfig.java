package com.back.nbe1214finalsour.global.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * 최소 Security 설정 (SCRUM-51). JWT 인증 필터는 회원·인증 작업에서 추가한다.
 *
 * <p>401/403은 컨트롤러 밖(필터)에서 결정되므로 {@code GlobalExceptionHandler}가 아니라
 * {@link ApiAuthenticationEntryPoint}와 {@link ApiAccessDeniedHandler}가 {@code ApiResponse}로 응답한다.
 */
@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final ApiAuthenticationEntryPoint authenticationEntryPoint;
    private final ApiAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/error", "/actuator/health").permitAll()
                        // TODO(JWT 인증 작업): JWT 필터를 붙이면 API 명세서의 인증 표기(필요·선택·불필요·관리자)대로 바꾼다.
                        // 그전까지 팀원이 로컬에서 API를 호출할 수 있도록 임시로 모두 허용한다.
                        .requestMatchers("/api/**").permitAll()
                        .anyRequest().denyAll());
        return http.build();
    }
}
