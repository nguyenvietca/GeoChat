package com.geochat.user.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {

	@jakarta.persistence.Version
	@Column(name = "row_version", nullable = false)
	private long rowVersion;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private UserRole role = UserRole.USER;
	@Column(name = "auth_version", nullable = false)
	private long authVersion;
	@Column(name = "self_deactivated_at")
	private Instant selfDeactivatedAt;
	@Column(name = "block_reason", length = 500)
	private String blockReason;

	public UserRole getRole() { return role; }
	public void setRole(UserRole role) { this.role = role; }
	public long getAuthVersion() { return authVersion; }
	public void setAuthVersion(long version) { authVersion = version; }
	public Instant getSelfDeactivatedAt() { return selfDeactivatedAt; }
	public void setSelfDeactivatedAt(Instant value) { selfDeactivatedAt = value; }
	public String getBlockReason() { return blockReason; }
	public void setBlockReason(String reason) { blockReason = reason; }

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 255)
	private String username;

	@Column(name = "password_hash", nullable = false)
	private String passwordHash;

	@Column(name = "password_login_enabled", nullable = false)
	private boolean passwordLoginEnabled = true;

	public boolean isPasswordLoginEnabled() {
		return passwordLoginEnabled;
	}

	public void setPasswordLoginEnabled(boolean enabled) {
		passwordLoginEnabled = enabled;
	}

	@Column(name = "display_name", nullable = false)
	private String displayName;

	@Column(length = 320)
	private String email;

	@Column(name = "phone_number", length = 32)
	private String phoneNumber;

	@Column(name = "avatar_storage_key", length = 64)
	private String avatarStorageKey;

	@Column(name = "avatar_content_type", length = 32)
	private String avatarContentType;

	@Column(name = "avatar_updated_at")
	private Instant avatarUpdatedAt;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private UserStatus status = UserStatus.ACTIVE;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt = Instant.now();

	@Column(name = "nearby_discoverable", nullable = false)
	private boolean nearbyDiscoverable;

	public boolean isNearbyDiscoverable() {
		return nearbyDiscoverable;
	}

	public void setNearbyDiscoverable(boolean value) {
		nearbyDiscoverable = value;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getUsername() {
		return username;
	}

	public void setUsername(String username) {
		this.username = username;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public void setPasswordHash(String passwordHash) {
		this.passwordHash = passwordHash;
	}

	public String getDisplayName() {
		return displayName;
	}

	public void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getPhoneNumber() {
		return phoneNumber;
	}

	public void setPhoneNumber(String phoneNumber) {
		this.phoneNumber = phoneNumber;
	}

	public String getAvatarStorageKey() {
		return avatarStorageKey;
	}

	public void setAvatarStorageKey(String avatarStorageKey) {
		this.avatarStorageKey = avatarStorageKey;
	}

	public String getAvatarContentType() {
		return avatarContentType;
	}

	public void setAvatarContentType(String avatarContentType) {
		this.avatarContentType = avatarContentType;
	}

	public Instant getAvatarUpdatedAt() {
		return avatarUpdatedAt;
	}

	public void setAvatarUpdatedAt(Instant avatarUpdatedAt) {
		this.avatarUpdatedAt = avatarUpdatedAt;
	}

	public UserStatus getStatus() {
		return status;
	}

	public void setStatus(UserStatus status) {
		this.status = status;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Instant createdAt) {
		this.createdAt = createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public void setUpdatedAt(Instant updatedAt) {
		this.updatedAt = updatedAt;
	}
}
