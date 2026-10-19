package com.geochat.user.service;

import java.time.Instant;
import com.geochat.user.entity.*;
import com.geochat.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountLifecycleService {
	private final UserRepository users;
	private final PasswordEncoder passwords;
	private final JdbcTemplate jdbc;
	private final ApplicationEventPublisher events;

	public record AccessChanged(Long userId) {
	}

	public AccountLifecycleService(UserRepository users, PasswordEncoder passwords, JdbcTemplate jdbc,
			ApplicationEventPublisher events) {
		this.users = users;
		this.passwords = passwords;
		this.jdbc = jdbc;
		this.events = events;
	}

	private User locked(Long id) {
		return users.lockById(id).orElseThrow(() -> new EntityNotFoundException("User not found"));
	}

	private User passwordProof(String username, String password) {
		User found = users.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new BadCredentialsException("Invalid username or password"));
		User user = locked(found.getId());
		if (!user.isPasswordLoginEnabled() || password == null || password.length() > 128
				|| !passwords.matches(password, user.getPasswordHash()))
			throw new BadCredentialsException("Invalid username or password");
		return user;
	}

	@Transactional
	public void deactivate(String username, String password) {
		User user;
		try {
			user = passwordProof(username, password);
		} catch (BadCredentialsException ex) {
			throw new IllegalArgumentException("Current password is incorrect.");
		}
		deactivateVerified(user);
	}

	// Only called after verifying a linked Google subject, never by email matching.
	@Transactional
	public void deactivateGoogle(Long userId, long version) {
		User user = locked(userId);
		if (user.getAuthVersion() != version)
			throw new AccessDeniedException("Sign in again.");
		deactivateVerified(user);
	}

	private void deactivateVerified(User user) {
        if (user.getRole().isAdmin())
			throw new IllegalArgumentException("Transfer the admin role before deactivating this account.");
		if (user.getStatus() != UserStatus.ACTIVE)
			throw new AccessDeniedException("Account unavailable.");
		user.setSelfDeactivatedAt(Instant.now());
		user.setStatus(UserStatus.INACTIVE);
		changed(user, user.getId(), "DEACTIVATE", null);
	}

	@Transactional
	public User reactivateSession(Long id, long version) {
		User user = locked(id);
		if (user.getAuthVersion() != version)
			throw new AccessDeniedException("Sign in again.");
		return reactivateVerified(user);
	}

	private User reactivateVerified(User user) {
		if (user.getStatus() == UserStatus.LOCKED)
			throw new AccessDeniedException("This account is blocked. Contact an administrator.");
		if (user.getStatus() != UserStatus.INACTIVE || user.getSelfDeactivatedAt() == null)
			throw new IllegalArgumentException("This account is already active. Please sign in.");
		user.setSelfDeactivatedAt(null);
		user.setStatus(UserStatus.ACTIVE);
		changed(user, user.getId(), "REACTIVATE", null);
		return user;
	}

	@Transactional
	public void moderate(String adminName, Long userId, boolean block, String reason) {
		users.lockAdministrators();
        User admin = users.findByUsernameIgnoreCase(adminName).orElseThrow();
        if (!admin.getRole().isAdmin() || admin.getStatus() != UserStatus.ACTIVE)
			throw new AccessDeniedException("Access denied");
		User user = locked(userId);
        if (user.getRole().isAdmin())
			throw new IllegalArgumentException("Admin accounts cannot be blocked here.");
		if (reason == null || reason.isBlank() || reason.strip().length() > 500)
			throw new IllegalArgumentException("Enter a reason between 1 and 500 characters.");
		String previous = user.getStatus().name();
        if (block) {
			if (user.getStatus() == UserStatus.LOCKED)
				throw new com.geochat.user.exception.AccountStateConflict("This account is already blocked.");
			user.setStatus(UserStatus.LOCKED);
			user.setBlockReason(reason.strip());
		} else {
			if (user.getStatus() != UserStatus.LOCKED)
				throw new com.geochat.user.exception.AccountStateConflict("This account is not blocked.");
			user.setStatus(user.getSelfDeactivatedAt() == null ? UserStatus.ACTIVE : UserStatus.INACTIVE);
			user.setBlockReason(null);
		}
		changed(user, admin.getId(), block ? "BLOCK" : "UNBLOCK", reason.strip(), previous);
	}

	private void changed(User user, Long actor, String action, String reason) {
        changed(user,actor,action,reason,null);
    }

    private void changed(User user, Long actor, String action, String reason, String previous) {
		user.setAuthVersion(user.getAuthVersion() + 1);
		user.setNearbyDiscoverable(false);
		user.setUpdatedAt(Instant.now());
		users.saveAndFlush(user);
		jdbc.update("INSERT INTO account_actions(actor_id,user_id,action,reason,created_at,previous_status,new_status) VALUES (?,?,?,?,?,?,?)", actor,
				user.getId(), action, reason, java.sql.Timestamp.from(Instant.now()), previous,user.getStatus().name());
		events.publishEvent(new AccessChanged(user.getId()));
	}
}
