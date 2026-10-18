package com.geochat.auth.google;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "user_auth_identities", uniqueConstraints = {
		@UniqueConstraint(columnNames = { "provider", "provider_user_id" }),
		@UniqueConstraint(columnNames = { "user_id", "provider" }) })
public class GoogleIdentity {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	public Long id;
	@Column(name = "user_id", nullable = false)
	public Long userId;
	@Column(nullable = false, length = 16)
	public String provider = "GOOGLE";
	@Column(name = "provider_user_id", nullable = false)
	public String subject;
	@Column(name = "provider_email", nullable = false, length = 320)
	public String email;
	@Column(name = "created_at", nullable = false)
	public Instant createdAt = Instant.now();
	@Column(name = "updated_at", nullable = false)
	public Instant updatedAt = Instant.now();
}
