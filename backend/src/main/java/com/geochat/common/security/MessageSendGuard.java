package com.geochat.common.security;

import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class MessageSendGuard {
    private final SlidingRequestLimits limits;
    private final boolean enabled;

    @org.springframework.beans.factory.annotation.Autowired
    public MessageSendGuard(@Value("${app.security.rate-limit.enabled:true}") boolean enabled) {
        this(enabled, new SlidingRequestLimits());
    }

    MessageSendGuard(boolean enabled, SlidingRequestLimits limits) { this.enabled = enabled; this.limits = limits; }

    public void check(String username) {
        if (!enabled) return;
        String user = username.toLowerCase(Locale.ROOT);
        limits.check("second:" + user, 5, 1000);
        limits.check("minute:" + user, 120, 60_000);
    }
}
