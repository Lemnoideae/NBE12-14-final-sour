package com.back.nbe1214finalsour;

import com.back.nbe1214finalsour.domain.auth.mail.VerificationMailSender;
import com.back.nbe1214finalsour.domain.support.mail.SupportAnswerMailSender;
import com.back.nbe1214finalsour.domain.university.service.rival.RivalChecker;
import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import com.back.nbe1214finalsour.global.turnstile.TurnstileVerifier;
import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.annotation.AliasFor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;


@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Tag("integration")
@AutoConfigureMockMvc
@MockitoBean(types = {VerificationMailSender.class, SupportAnswerMailSender.class, TurnstileVerifier.class})
@MockitoSpyBean(types = {RivalChecker.class, UserRepository.class})
public @interface IntegrationTest {

    /** 실제 서버가 필요한 테스트(예: 서블릿 오류 디스패치)는 {@code RANDOM_PORT}로 바꾼다. */
    @AliasFor(annotation = SpringBootTest.class, attribute = "webEnvironment")
    SpringBootTest.WebEnvironment webEnvironment() default SpringBootTest.WebEnvironment.MOCK;
}