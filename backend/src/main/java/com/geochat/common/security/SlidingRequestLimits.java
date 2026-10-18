package com.geochat.common.security;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;

/** Bounded, atomic rolling windows. Stores no passwords, tokens or request bodies. */
public class SlidingRequestLimits {
    private record Window(ArrayDeque<Long> hits, long duration) {}
    private final Map<String, Window> windows = new HashMap<>();
    private final Clock clock;
    private long checks;

    public SlidingRequestLimits() { this(Clock.systemUTC()); }
    SlidingRequestLimits(Clock clock) { this.clock = clock; }

    public synchronized void check(String key, int limit, long milliseconds) {
        long now = clock.millis();
        if ((++checks & 255) == 0 || windows.size() >= 20_000) {
            windows.values().removeIf(w -> w.hits().isEmpty() || w.hits().getLast() + w.duration() <= now);
        }
        Window window = windows.get(key);
        if (window == null) {
            if (windows.size() >= 20_000) throw new RequestLimitException(60);
            window = new Window(new ArrayDeque<>(), milliseconds);
            windows.put(key, window);
        }
        while (!window.hits().isEmpty() && window.hits().getFirst() <= now - milliseconds) window.hits().removeFirst();
        if (window.hits().size() >= limit) {
            throw new RequestLimitException((window.hits().getFirst() + milliseconds - now + 999) / 1000);
        }
        window.hits().addLast(now);
    }
}
