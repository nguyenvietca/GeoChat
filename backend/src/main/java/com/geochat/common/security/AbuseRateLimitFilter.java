package com.geochat.common.security;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Small per-instance abuse guard. It deliberately ignores forwarded headers. */
public final class AbuseRateLimitFilter extends OncePerRequestFilter {
    private static final int MAX_KEYS = 20_000;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong requests = new AtomicLong();
    private final boolean enabled;

    public AbuseRateLimitFilter(boolean enabled) { this.enabled = enabled; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Policy policy = policy(request);
        if (!enabled || policy == null) {
            chain.doFilter(request, response);
            return;
        }
        long now = Instant.now().getEpochSecond();
        if ((requests.incrementAndGet() & 255) == 0) {
            windows.entrySet().removeIf(entry -> now >= entry.getValue().resetAt());
        }
        String identity = identity(request);
        String key = policy.name() + ':' + identity;
        Decision decision = new Decision();
        windows.compute(key, (ignored, current) -> {
            if (current == null || now >= current.resetAt()) {
                if (current == null && windows.size() >= MAX_KEYS) {
                    decision.denied = true;
                    decision.retryAfter = 60;
                    return null;
                }
                return new Window(1, now + policy.windowSeconds());
            }
            if (current.count() >= policy.limit()) {
                decision.denied = true;
                decision.retryAfter = Math.max(1, current.resetAt() - now);
                return current;
            }
            return new Window(current.count() + 1, current.resetAt());
        });
        if (decision.denied) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Retry-After", Long.toString(decision.retryAfter));
            response.getWriter().write("{\"success\":false,\"data\":null,\"message\":\"Too many requests. Please wait and try again.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private String identity(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getName())) {
            return "user:" + authentication.getName().toLowerCase(java.util.Locale.ROOT);
        }
        return "ip:" + request.getRemoteAddr();
    }

    private Policy policy(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getRequestURI();
        if ("POST".equals(method) && "/api/v1/auth/login".equals(path)) return new Policy("login", 10, 60);
        if ("POST".equals(method) && "/api/v1/auth/register".equals(path)) return new Policy("register", 5, 3600);
        if ("POST".equals(method) && "/api/v1/friends/requests".equals(path)) return new Policy("friend-request", 20, 60);
        if ("GET".equals(method) && "/api/v1/users/search".equals(path)) return new Policy("user-search", 60, 60);
        if ("POST".equals(method) && path.matches("/api/v1/chats/\\d+/(messages|images)")) return new Policy("message", 120, 60);
        return null;
    }

    int trackedKeys() { return windows.size(); }
    private record Policy(String name, int limit, long windowSeconds) {}
    private record Window(int count, long resetAt) {}
    private static final class Decision { private boolean denied; private long retryAfter; }
}
