package com.back.nbe1214finalsour;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.annotation.AliasFor;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Tag("integration")
public @interface IntegrationTest {

    /** 실제 서버가 필요한 테스트(예: 서블릿 오류 디스패치)는 {@code RANDOM_PORT}로 바꾼다. */
    @AliasFor(annotation = SpringBootTest.class, attribute = "webEnvironment")
    SpringBootTest.WebEnvironment webEnvironment() default SpringBootTest.WebEnvironment.MOCK;
}