package com.geochat.common.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LoginAttemptGuard {
    private final SlidingRequestLimits limits = new SlidingRequestLimits();
    private final boolean enabled;

    public LoginAttemptGuard(@Value("${app.security.rate-limit.enabled:true}") boolean enabled) { this.enabled = enabled; }

    public void check(String username, String ip) {
        if (!enabled) return;
        String key;
        try {
            key = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(
                    username.trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
        // Count all attempts, including unknown users and successes: no account-existence oracle.
        limits.check("pair:" + ip + ':' + key, 5, 60_000);
        limits.check("account:" + key, 30, 300_000);
    }
}
