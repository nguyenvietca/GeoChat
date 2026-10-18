package com.geochat.common.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class AbuseRateLimitFilterTest {
    @Test
    void limitsLoginBySocketAddressWithJsonAndRetryAfter() throws Exception {
        var clock = new SecurityLimitsTest.Time();
        AbuseRateLimitFilter filter = new AbuseRateLimitFilter(true, new ClientAddress(""), new SlidingRequestLimits(clock));
        AtomicInteger accepted = new AtomicInteger();
        for (int index = 0; index < 10; index++) {
            clock.now += 1000;
            MockHttpServletResponse response = invoke(filter, "POST", "/api/v1/auth/login", "192.0.2.1", accepted);
            assertThat(response.getStatus()).isEqualTo(200);
        }
        MockHttpServletResponse limited = invoke(filter, "POST", "/api/v1/auth/login", "192.0.2.1", accepted);
        assertThat(limited.getStatus()).isEqualTo(429);
        assertThat(limited.getHeader("Retry-After")).isNotBlank();
        assertThat(limited.getContentAsString()).contains("Too many requests").doesNotContain("192.0.2.1");
        assertThat(accepted).hasValue(10);

        assertThat(invoke(filter, "POST", "/api/v1/auth/login", "192.0.2.2", accepted).getStatus()).isEqualTo(200);
    }

    @Test
    void ignoresUnprotectedRoutesAndCanBeDisabledForDeterministicTestProfiles() throws Exception {
        AtomicInteger accepted = new AtomicInteger();
        AbuseRateLimitFilter enabled = new AbuseRateLimitFilter(true);
        for (int index = 0; index < 20; index++)
            assertThat(invoke(enabled, "GET", "/api/health", "192.0.2.3", accepted).getStatus()).isEqualTo(200);
        AbuseRateLimitFilter disabled = new AbuseRateLimitFilter(false);
        for (int index = 0; index < 12; index++)
            assertThat(invoke(disabled, "POST", "/api/v1/auth/login", "192.0.2.4", accepted).getStatus()).isEqualTo(200);
    }

    private MockHttpServletResponse invoke(AbuseRateLimitFilter filter, String method, String path, String address,
            AtomicInteger accepted) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRemoteAddr(address);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> accepted.incrementAndGet());
        return response;
    }
}
