package com.geochat.auth.password;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "password_reset_tokens")
public class PasswordResetToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) String tokenHash;
    @Column(name = "user_id", nullable = false) Long userId;
    @Column(nullable = false, length = 320) String email;
    @Column(name = "auth_version", nullable = false) long authVersion;
    @Column(name = "expires_at", nullable = false) Instant expiresAt;
}
