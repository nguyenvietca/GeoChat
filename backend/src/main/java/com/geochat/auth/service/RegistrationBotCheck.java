package com.geochat.auth.service;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

@Service
public class RegistrationBotCheck {
    private final boolean enabled;
    private final String siteKey;
    private final String secret;
    private final Set<String> hostnames;
    private final RestClient client;

    @Autowired
    public RegistrationBotCheck(@Value("${app.security.registration-bot-check.enabled:false}") boolean enabled,
            @Value("${app.security.registration-bot-check.site-key:}") String siteKey,
            @Value("${app.security.registration-bot-check.secret:}") String secret,
            @Value("${app.security.registration-bot-check.hostnames:}") String hosts) {
        this(enabled, siteKey, secret, hosts, client());
    }

    RegistrationBotCheck(boolean enabled, String siteKey, String secret, String hosts, RestClient client) {
        this.enabled = enabled;
        this.siteKey = siteKey;
        this.secret = secret;
        this.hostnames = Arrays.stream(hosts.split(",")).map(String::trim).filter(s -> !s.isBlank()).collect(Collectors.toSet());
        this.client = client;
        if (enabled && (invalidKey(siteKey) || invalidKey(secret) || hostnames.isEmpty()))
            throw new IllegalStateException("Enabled registration bot check requires keys and allowed hostnames.");
    }

    private static boolean invalidKey(String value) {
        String lower = value.toLowerCase(java.util.Locale.ROOT);
        return value.isBlank() || lower.contains("replace") || lower.contains("placeholder") || lower.contains("your-")
                || lower.contains("secret") || lower.contains("example") || value.startsWith("1x000000") || value.startsWith("2x000000") || value.startsWith("3x000000");
    }

    private static RestClient client() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2000);
        factory.setReadTimeout(3000);
        return RestClient.builder().baseUrl("https://challenges.cloudflare.com/turnstile/v0/siteverify")
                .requestFactory(factory).build();
    }

    public record Config(boolean enabled, String siteKey) {}
    public Config config() { return new Config(enabled, enabled ? siteKey : null); }
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public record Verdict(boolean success, String hostname, String action) {}

    public void verify(String token, String ip) {
        if (!enabled) return;
        if (token == null || token.isBlank() || token.length() > 2048) throw rejected();
        var form = new LinkedMultiValueMap<String, String>();
        form.add("secret", secret);
        form.add("response", token);
        form.add("remoteip", ip);
        Verdict verdict;
        try {
            verdict = client.post().contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form)
                    .retrieve().body(Verdict.class);
        } catch (RuntimeException failure) {
            // Never echo provider bodies, token, secret or a stack trace to the browser/log.
            throw rejected();
        }
        if (verdict == null || !verdict.success() || !hostnames.contains(verdict.hostname()) || !"register".equals(verdict.action()))
            throw rejected();
    }

    private static IllegalArgumentException rejected() {
        return new IllegalArgumentException("Registration verification failed or expired. Please verify again.");
    }
}
