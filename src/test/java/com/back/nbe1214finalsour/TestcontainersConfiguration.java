package com.back.nbe1214finalsour;

import io.floci.testcontainers.FlociContainer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(DockerImageName.parse("postgres:latest"));
    }

    @Bean
    @ServiceConnection(name = "redis")
    GenericContainer<?> redisContainer() {
        return new GenericContainer<>(DockerImageName.parse("redis:latest")).withExposedPorts(6379);
    }

    // S3 대신 쓰는 AWS 에뮬레이터 (로고 이미지 업로드). 인증 토큰 없이 쓸 수 있다.
    // @ServiceConnection으로 S3 클라이언트의 주소·리전·키가 이 컨테이너로 자동 연결된다
    @Bean
    @ServiceConnection
    FlociContainer flociContainer() {
        return new FlociContainer(DockerImageName.parse("floci/floci:latest"));
    }

}
