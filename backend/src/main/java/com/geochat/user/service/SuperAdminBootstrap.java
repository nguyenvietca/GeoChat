package com.geochat.user.service;

import com.geochat.user.entity.*;
import com.geochat.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Component
public class SuperAdminBootstrap implements ApplicationRunner {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final boolean enabled;
    private final String username, email, password;
    public SuperAdminBootstrap(UserRepository users, PasswordEncoder passwords,
            @Value("${app.super-admin.enabled:false}") boolean enabled,
            @Value("${app.super-admin.username:geochat_super_admin}") String username,
            @Value("${app.super-admin.email:}") String email,
            @Value("${app.super-admin.password:}") String password) {
        this.users = users; this.passwords = passwords; this.enabled = enabled;
        this.username = username; this.email = email; this.password = password;
    }

    @Override @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled) return;
        // A completed bootstrap never resets credentials or reopens a blocked account.
        if (users.existsByRoleAndPasswordLoginEnabledTrue(UserRole.SUPER_ADMIN)) return;
        if (!username.matches("[A-Za-z0-9_]{3,50}")
                || email.length() > 320 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")
                || password.length() < 16 || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
            throw new IllegalStateException("Configure a valid super-admin username, email and password (16-72 UTF-8 bytes).");
        User seed = users.findByUsernameIgnoreCase("geochat_super_admin")
                .flatMap(u -> users.lockById(u.getId())).orElseThrow(() -> new IllegalStateException("Super-admin migration seed is missing."));
        if (seed.getRole() != UserRole.SUPER_ADMIN || seed.isPasswordLoginEnabled()
                || !"!bootstrap-required".equals(seed.getPasswordHash()))
            throw new IllegalStateException("Reserved super-admin identity is already in use; resolve it through the deployment operator.");
        if ((!seed.getUsername().equalsIgnoreCase(username) && users.existsByUsernameIgnoreCase(username))
                || users.existsByEmailIgnoreCase(email.strip()))
            throw new IllegalStateException("Super-admin username or email is already in use.");
        seed.setUsername(username); seed.setEmail(email.strip().toLowerCase(java.util.Locale.ROOT));
        seed.setPasswordHash(passwords.encode(password)); seed.setPasswordLoginEnabled(true);
        seed.setStatus(UserStatus.ACTIVE); seed.setAuthVersion(seed.getAuthVersion() + 1);
        seed.setUpdatedAt(Instant.now()); users.saveAndFlush(seed);
    }
}
