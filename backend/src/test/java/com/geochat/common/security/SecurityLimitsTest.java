package com.geochat.common.security;

import java.time.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;

class SecurityLimitsTest {
    static class Time extends Clock {
        long now = 10_000;
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return Instant.ofEpochMilli(now); }
    }

    @Test void trustedProxyUsesOnlySingleOverwrittenLiteralAndDirectClientsCannotSpoof() {
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Real-IP", "192.0.2.5");
        request.addHeader("X-Forwarded-For", "192.0.2.9");
        assertThat(new ClientAddress("").resolve(request)).isEqualTo("127.0.0.1");
        assertThat(new ClientAddress("127.0.0.1").resolve(request)).isEqualTo("192.0.2.5");
        request.removeHeader("X-Real-IP");
        request.addHeader("X-Real-IP", "192.0.2.5, 192.0.2.9");
        assertThat(new ClientAddress("127.0.0.1").resolve(request)).isEqualTo("127.0.0.1");
        request.removeHeader("X-Real-IP");
        request.addHeader("X-Real-IP", "attacker.example");
        assertThat(new ClientAddress("127.0.0.1").resolve(request)).isEqualTo("127.0.0.1");
    }

    @Test void rollingWindowsDoNotResetAtWallClockBoundariesAndRecoverAfterExpiry() {
        Time clock = new Time();
        SlidingRequestLimits limits = new SlidingRequestLimits(clock);
        clock.now = 10_999;
        for (int i=0; i<5; i++) limits.check("user", 5, 1000);
        clock.now = 11_000;
        assertThatThrownBy(() -> limits.check("user", 5, 1000)).isInstanceOf(RequestLimitException.class);
        limits.check("other-user", 5, 1000);
        clock.now = 11_999;
        assertThatCode(() -> limits.check("user", 5, 1000)).doesNotThrowAnyException();
    }

    @Test void concurrentBurstCannotExceedFiveAndCaseDoesNotCreateAnotherBucket() throws Exception {
        MessageSendGuard guard = new MessageSendGuard(true, new SlidingRequestLimits(new Time()));
        AtomicInteger accepted = new AtomicInteger();
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(8)) {
            var tasks = new java.util.ArrayList<Future<?>>();
            for (int i=0; i<20; i++) tasks.add(pool.submit(() -> {
                try { start.await(); guard.check("Alice"); accepted.incrementAndGet(); }
                catch (RequestLimitException expected) { }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }));
            start.countDown();
            for (var task: tasks) task.get(5, TimeUnit.SECONDS);
            assertThat(accepted.get()).isEqualTo(5);
            assertThatThrownBy(() -> guard.check("ALICE")).isInstanceOf(RequestLimitException.class);
            assertThatCode(() -> guard.check("Bob")).doesNotThrowAnyException();
        }
    }

    @Test void loginAccountBudgetSurvivesIpRotationAndPairBudgetIsIndependentOfUserExistence() {
        LoginAttemptGuard guard = new LoginAttemptGuard(true);
        for (int i=0; i<5; i++) guard.check("Unknown", "192.0.2.1");
        assertThatThrownBy(() -> guard.check("UNKNOWN", "192.0.2.1")).isInstanceOf(RequestLimitException.class);
        for (int i=0; i<25; i++) guard.check("Unknown", "192.0.2." + (i+2));
        assertThatThrownBy(() -> guard.check("unknown", "192.0.2.200")).isInstanceOf(RequestLimitException.class);
        assertThatCode(() -> guard.check("Different", "192.0.2.1")).doesNotThrowAnyException();
    }

    @Test void nginxClientsHaveSeparateLimitsButBearerAndSpoofedHeadersCannotEvadeAuthIpBudget() throws Exception {
        var filter = new AbuseRateLimitFilter(true, new ClientAddress("127.0.0.1"));
        try {
            for (int i=0; i<3; i++) assertThat(login(filter, "192.0.2.1").getStatus()).isEqualTo(200);
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("another-user", null, java.util.List.of()));
            assertThat(login(filter, "192.0.2.1").getStatus()).isEqualTo(429);
            assertThat(login(filter, "192.0.2.2").getStatus()).isEqualTo(200);
        } finally { SecurityContextHolder.clearContext(); }
    }

    private MockHttpServletResponse login(AbuseRateLimitFilter filter, String ip) throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr("127.0.0.1"); request.addHeader("X-Real-IP", ip);
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (r,s) -> {});
        return response;
    }

    @Test void excessiveUploadBurstIsRejectedBeforeReadingBody() throws Exception {
        var filter = new AbuseRateLimitFilter(true, new ClientAddress(""), new SlidingRequestLimits(new Time()));
        var parsed = new AtomicInteger();
        for (int i=0; i<11; i++) {
            var request = new MockHttpServletRequest("POST", "/api/v1/chats/1/images");
            request.setRemoteAddr("192.0.2.10");
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, (r,s) -> parsed.incrementAndGet());
            assertThat(response.getStatus()).isEqualTo(i<10 ? 200 : 429);
        }
        assertThat(parsed.get()).isEqualTo(10);
    }
}
