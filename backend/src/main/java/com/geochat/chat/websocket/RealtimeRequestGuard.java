package com.geochat.chat.websocket;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class RealtimeRequestGuard {
    private static final int MAX_KEYS = 20_000;
    private record Window(long start, int count) {}
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public void check(String username, String action, int limit) {
        long now = System.currentTimeMillis();
        if (windows.size() >= MAX_KEYS) windows.entrySet().removeIf(entry -> now - entry.getValue().start() >= 60_000);
        String key = username.toLowerCase(java.util.Locale.ROOT) + ':' + action;
        if (!windows.containsKey(key) && windows.size() >= MAX_KEYS) {
            throw new AccessDeniedException("Too many realtime requests. Please wait and try again.");
        }
        final boolean[] denied = { false };
        windows.compute(key, (ignored, current) -> {
            if (current == null || now - current.start() >= 60_000) return new Window(now, 1);
            if (current.count() >= limit) { denied[0] = true; return current; }
            return new Window(current.start(), current.count() + 1);
        });
        if (denied[0]) {
            throw new AccessDeniedException("Too many realtime requests. Please wait and try again.");
        }
    }
}
