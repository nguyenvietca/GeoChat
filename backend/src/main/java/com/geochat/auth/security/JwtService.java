package com.geochat.auth.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

	private final String secret;
	private final long expirationMs;

	public JwtService(@Value("${jwt.secret}") String secret, @Value("${jwt.expiration-ms:3600000}") long expirationMs) {
		if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
			throw new IllegalStateException("JWT_SECRET must contain at least 32 UTF-8 bytes");
		}
		this.secret = secret;
		this.expirationMs = expirationMs;
	}

	public String generateToken(Long userId, String username) {
		Instant now = Instant.now();
		return Jwts.builder().subject(username).claim("userId", userId).issuedAt(Date.from(now))
				.expiration(Date.from(now.plusMillis(expirationMs))).signWith(getSigningKey()).compact();
	}

	public boolean isTokenValid(String token) {
		try {
			parseClaims(token);
			return true;
		} catch (Exception ex) {
			return false;
		}
	}

	public String getUsername(String token) {
		return parseClaims(token).getSubject();
	}

	public Long getUserId(String token) {
		Claims claims = parseClaims(token);
		return claims.get("userId", Number.class).longValue();
	}

	public Instant getExpiration(String token) {
		return parseClaims(token).getExpiration().toInstant();
	}

	private Claims parseClaims(String token) {
		return Jwts.parser().verifyWith(getSigningKey()).build().parseSignedClaims(token).getPayload();
	}

	private SecretKey getSigningKey() {
		return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
	}
}
