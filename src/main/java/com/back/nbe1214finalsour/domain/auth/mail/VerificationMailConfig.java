package com.back.nbe1214finalsour.domain.auth.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * 인증 메일 발송 방식을 고른다.
 *
 * <ul>
 *   <li>{@code spring.mail.host}가 있으면 SMTP로 보낸다.</li>
 *   <li>없으면 {@code prod}가 아닌 프로필에서만 코드를 로그에 남기는 개발용 구현을 쓴다.</li>
 *   <li>{@code prod}에서 SMTP 설정이 없으면 이 빈이 없어 앱이 시작하지 않는다. 메일 없이 배포되는 것을 막기 위함이다.</li>
 * </ul>
 *
 * <p>두 빈의 조건은 선언 순서대로 평가되므로 SMTP 빈을 먼저 둔다.
 */
@Configuration(proxyBeanMethods = false)
public class VerificationMailConfig {

    @Bean
    @ConditionalOnProperty(prefix = "spring.mail", name = "host")
    public VerificationMailSender smtpVerificationMailSender(
            JavaMailSender javaMailSender,
            @Value("${verification-mail.from:}") String from) {
        return new SmtpVerificationMailSender(javaMailSender, from);
    }

    @Bean
    @Profile("!prod")
    @ConditionalOnMissingBean(VerificationMailSender.class)
    public VerificationMailSender loggingVerificationMailSender() {
        return new LoggingVerificationMailSender();
    }
}
