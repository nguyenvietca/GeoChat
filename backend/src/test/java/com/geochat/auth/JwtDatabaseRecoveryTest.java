package com.geochat.auth;

import com.geochat.auth.security.JwtAuthenticationFilter;
import com.geochat.auth.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.transaction.CannotCreateTransactionException;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class JwtDatabaseRecoveryTest {
    @AfterEach
    void clearContext() { SecurityContextHolder.clearContext(); }

    static Stream<RuntimeException> databaseFailures() {
        return Stream.of(new DataAccessResourceFailureException("private jdbc details"),
                new CannotCreateTransactionException("private database credentials"));
    }

    @ParameterizedTest
    @MethodSource("databaseFailures")
    void preservesTheSessionAcrossAnUnavailableUserDatabase(RuntimeException failure) throws Exception {
        JwtService jwt = mock(JwtService.class);
        UserDetailsService users = mock(UserDetailsService.class);
        when(jwt.isTokenValid("valid-token")).thenReturn(true);
        when(jwt.getUsername("valid-token")).thenReturn("release-user");
        when(users.loadUserByUsername("release-user")).thenThrow(failure)
                .thenReturn(User.withUsername("release-user").password("unused").authorities("ROLE_USER").build());
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwt, users);
        AtomicInteger authorizedRequests = new AtomicInteger();

        MockHttpServletResponse unavailable = invoke(filter, authorizedRequests);
        assertThat(unavailable.getStatus()).isEqualTo(503);
        assertThat(unavailable.getContentAsString()).contains("\"success\":false", "temporarily unavailable")
                .doesNotContain("private", "jdbc", "credentials");
        assertThat(unavailable.getHeader("Retry-After")).isEqualTo("5");
        assertThat(unavailable.getHeader("Cache-Control")).isEqualTo("no-store");
        assertThat(authorizedRequests).hasValue(0);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();

        assertThat(invoke(filter, authorizedRequests).getStatus()).isEqualTo(200);
        assertThat(authorizedRequests).hasValue(1);
        assertThat(SecurityContextHolder.getContext().getAuthentication().getName()).isEqualTo("release-user");
    }

    private MockHttpServletResponse invoke(JwtAuthenticationFilter filter, AtomicInteger accepted) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/chats");
        request.addHeader("Authorization", "Bearer valid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> accepted.incrementAndGet());
        return response;
    }
}
