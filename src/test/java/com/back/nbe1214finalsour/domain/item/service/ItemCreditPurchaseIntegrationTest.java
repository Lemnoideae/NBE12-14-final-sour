package com.back.nbe1214finalsour.domain.item.service;

import com.back.nbe1214finalsour.IntegrationTest;
import com.back.nbe1214finalsour.global.exception.BusinessException;
import com.back.nbe1214finalsour.global.exception.ErrorCode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// 커밋·롤백을 실제로 확인해야 하므로 @Transactional(테스트 후 롤백)을 쓰지 않고, 넣은 데이터는 직접 지운다
@IntegrationTest
class ItemCreditPurchaseIntegrationTest {

    private static final String LOGO_URL = "https://cdn.devcproject.cloud/custom-logo/1/abc.png";
    private static final int THREAD_COUNT = 10;

    @Autowired
    private ItemPurchaseService itemPurchaseService;

    @Autowired
    private ItemService itemService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long universityId;
    private Long departmentId;
    private Long userId;
    private Long universityLogoItemId;
    private Long departmentLogoItemId;
    private final List<Long> insertedItemIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        universityId = jdbcTemplate.queryForObject(
                "INSERT INTO university (name) VALUES ('크레딧구매테스트대') RETURNING id", Long.class);
        departmentId = jdbcTemplate.queryForObject(
                "INSERT INTO department (university_id, name) VALUES (?, '컴퓨터공학과') RETURNING id",
                Long.class, universityId);
        userId = jdbcTemplate.queryForObject("""
                INSERT INTO users (university_id, department_id, nickname, email, email_hash, password, approved_at)
                VALUES (?, ?, '크레딧구매유저', 'credit-purchase@test.com', ?, 'password', now())
                RETURNING id
                """, Long.class, universityId, departmentId, "3".repeat(64));

        universityLogoItemId = logoItem("LOGO_UNIVERSITY", 3900);
        departmentLogoItemId = logoItem("LOGO_DEPARTMENT", 2900);
        itemService.loadItemTable();   // 서버 시작 때 캐시된 아이템 목록을 다시 읽음
    }

    @AfterEach
    void tearDown() {
        // FK 순서대로 삭제: credit_history → user_item → item·users → department → university
        jdbcTemplate.update("DELETE FROM credit_history WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM user_item WHERE user_id = ?", userId);
        insertedItemIds.forEach(id -> jdbcTemplate.update("DELETE FROM item WHERE id = ?", id));
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        jdbcTemplate.update("DELETE FROM department WHERE university_id = ?", universityId);
        jdbcTemplate.update("DELETE FROM university WHERE id = ?", universityId);
        itemService.loadItemTable();   // 아이템 목록 캐시를 원래대로
    }

    // 로고 아이템은 종류별로 하나만 허용(uk_item_logo_type)하므로, 이미 있으면 그걸 쓰고 이 테스트가 넣은 것만 기록해 두었다가 지운다
    private Long logoItem(String type, long price) {
        insertedItemIds.addAll(jdbcTemplate.queryForList("""
                INSERT INTO item (name, content, type, pay_type, price, duration, multiplier)
                VALUES (?, '테스트 로고 변경권', ?, 'CREDIT', ?, NULL, NULL)
                ON CONFLICT DO NOTHING
                RETURNING id
                """, Long.class, "크레딧구매테스트 " + type, type, price));
        return jdbcTemplate.queryForObject("SELECT id FROM item WHERE type = ?", Long.class, type);
    }

    private long priceOf(Long itemId) {
        return jdbcTemplate.queryForObject("SELECT price FROM item WHERE id = ?", Long.class, itemId);
    }

    private void setCredit(long balance) {
        jdbcTemplate.update("UPDATE users SET credit_balance = ? WHERE id = ?", balance, userId);
    }

    private long credit() {
        return jdbcTemplate.queryForObject("SELECT credit_balance FROM users WHERE id = ?", Long.class, userId);
    }

    private long count(String table) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM " + table + " WHERE user_id = ?", Long.class, userId);
    }

    private String logoOf(String table, Long id) {
        return jdbcTemplate.queryForObject("SELECT logo_url FROM " + table + " WHERE id = ?", String.class, id);
    }

    @Test
    @DisplayName("학교 로고 변경권 구매가 커밋되면 크레딧 차감·구매 이력·사용 내역·학교 로고가 한꺼번에 반영된다")
    void purchase_universityLogo_commitsAll() {
        // given: 가격보다 1100 많은 크레딧
        long price = priceOf(universityLogoItemId);
        setCredit(price + 1100);

        // when
        itemPurchaseService.purchase(userId, universityId, departmentId, universityLogoItemId, LOGO_URL);

        // then
        assertThat(credit()).isEqualTo(1100L);
        assertThat(count("user_item")).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForMap(
                "SELECT type, amount, balance_after FROM credit_history WHERE user_id = ?", userId))
                .containsEntry("type", "USE")
                .containsEntry("amount", price)
                .containsEntry("balance_after", 1100L);
        assertThat(logoOf("university", universityId)).isEqualTo(LOGO_URL);
    }

    @Test
    @DisplayName("크레딧이 부족하면 ITEM_NOT_ENOUGH_CREDIT이고 아무것도 바뀌지 않는다")
    void purchase_notEnoughCredit_changesNothing() {
        // given: 가격보다 1 적은 크레딧
        long price = priceOf(universityLogoItemId);
        setCredit(price - 1);

        // when & then
        assertThatThrownBy(() -> itemPurchaseService.purchase(userId, universityId, departmentId, universityLogoItemId, LOGO_URL))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.ITEM_NOT_ENOUGH_CREDIT);

        assertThat(credit()).isEqualTo(price - 1);
        assertThat(count("user_item")).isZero();
        assertThat(count("credit_history")).isZero();
        assertThat(logoOf("university", universityId)).isNull();
    }

    @Test
    @DisplayName("크레딧 차감 뒤 로고 적용에서 실패하면 차감·구매 이력·사용 내역까지 전부 롤백된다 (한 트랜잭션, 보상 불필요)")
    void purchase_failsAfterDeduct_rollsBackAll() {
        // given: 크레딧은 충분하지만, 토큰의 학과가 DB에 없음 → 차감·이력 저장 후 로고 적용 단계에서 실패
        long price = priceOf(departmentLogoItemId);
        setCredit(price + 1000);

        // when & then
        assertThatThrownBy(() -> itemPurchaseService.purchase(userId, universityId, 999_999L, departmentLogoItemId, LOGO_URL))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNIV_DEPARTMENT_NOT_FOUND);

        // then: 앞에서 실행된 크레딧 차감(JDBC)과 이력·사용 내역 저장(JPA)이 모두 취소됨
        assertThat(credit()).isEqualTo(price + 1000);
        assertThat(count("user_item")).isZero();
        assertThat(count("credit_history")).isZero();
    }

    @Test
    @DisplayName("같은 회원이 동시에 10번 사도 잔액만큼만 성공하고 크레딧은 음수가 되지 않는다 (이중 지출 없음)")
    void concurrentPurchase_noOverspend() throws InterruptedException {
        // given: 정확히 2번 살 수 있는 크레딧 + 100
        long price = priceOf(universityLogoItemId);
        setCredit(price * 2 + 100);

        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch finished = new CountDownLatch(THREAD_COUNT);
        AtomicInteger successCount = new AtomicInteger();
        AtomicInteger notEnoughCount = new AtomicInteger();
        List<Throwable> unexpectedErrors = Collections.synchronizedList(new ArrayList<>());

        // when
        try (ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT)) {
            for (int i = 0; i < THREAD_COUNT; i++) {
                executor.submit(() -> {
                    try {
                        startSignal.await();
                        itemPurchaseService.purchase(userId, universityId, departmentId, universityLogoItemId, LOGO_URL);
                        successCount.incrementAndGet();
                    } catch (BusinessException e) {
                        if (e.getErrorCode() == ErrorCode.ITEM_NOT_ENOUGH_CREDIT) {
                            notEnoughCount.incrementAndGet();   // 정상적인 실패
                        } else {
                            unexpectedErrors.add(e);
                        }
                    } catch (Throwable e) {
                        unexpectedErrors.add(e);
                    } finally {
                        finished.countDown();
                    }
                });
            }
            startSignal.countDown();
            assertThat(finished.await(10, TimeUnit.SECONDS)).isTrue();
        }

        // then
        assertThat(unexpectedErrors).isEmpty();
        assertThat(successCount.get()).isEqualTo(2);
        assertThat(notEnoughCount.get()).isEqualTo(8);
        assertThat(credit()).isEqualTo(100L);
        assertThat(count("user_item")).isEqualTo(2L);
        // 사용 내역의 차감 후 잔액이 겹치지 않음 (두 구매가 차례로 반영됨)
        assertThat(jdbcTemplate.queryForList(
                "SELECT balance_after FROM credit_history WHERE user_id = ? ORDER BY balance_after DESC", Long.class, userId))
                .containsExactly(price + 100, 100L);
    }
}