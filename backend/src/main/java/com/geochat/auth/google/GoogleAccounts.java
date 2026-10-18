package com.geochat.auth.google;

import java.util.Locale;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;
import com.geochat.user.repository.UserRepository;

@Service
public class GoogleAccounts {
	private final UserRepository users;
	private final GoogleIdentityRepository identities;
	private final PasswordEncoder passwords;
	private final TransactionTemplate transactions;

	public GoogleAccounts(UserRepository users, GoogleIdentityRepository identities, PasswordEncoder passwords,
			org.springframework.transaction.PlatformTransactionManager manager) {
		this.users = users;
		this.identities = identities;
		this.passwords = passwords;
		this.transactions = new TransactionTemplate(manager);
	}

	public record Claims(String subject, String email, boolean verified, String name) {
		public Claims {
			if (subject == null || subject.isBlank() || subject.length() > 255 || !verified || email == null
					|| email.isBlank() || email.length() > 320)
				throw new IllegalArgumentException("Google identity could not be verified.");
			email = email.trim().toLowerCase(Locale.ROOT);
		}
	}

	public record Connections(boolean passwordAvailable, boolean googleConnected, String email) {
	}

	public User active(Long id) {
		User user = signIn(id);
		if (user.getStatus() != UserStatus.ACTIVE)
			throw new org.springframework.security.access.AccessDeniedException("Activate your account before continuing.");
		return user;
	}

	private User signIn(Long id) {
		User user = users.findById(id).orElseThrow(() -> new BadCredentialsException("Account unavailable."));
		if (user.getStatus() == UserStatus.LOCKED)
			throw new org.springframework.security.access.AccessDeniedException("This account is blocked. Contact an administrator.");
		return user;
	}

	public User existingIdentity(Claims claims) {
		var identity = identities.findByProviderAndSubject("GOOGLE", claims.subject())
				.orElseThrow(() -> new BadCredentialsException("Account unavailable."));
		return users.findById(identity.userId).orElseThrow(() -> new BadCredentialsException("Account unavailable."));
	}

	public User reauthenticate(String username, String password) {
		User user = users.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new BadCredentialsException("Sign in again."));
		active(user.getId());
		if (!user.isPasswordLoginEnabled() || password == null || password.length() > 128
				|| !passwords.matches(password, user.getPasswordHash()))
			throw new IllegalArgumentException("Confirm your current password; keep a usable password sign-in method.");
		return user;
	}

	public Connections connections(String username) {
		User user = users.findByUsernameIgnoreCase(username).orElseThrow();
		active(user.getId());
		var identity = identities.findByUserIdAndProvider(user.getId(), "GOOGLE");
		return new Connections(user.isPasswordLoginEnabled(), identity.isPresent(),
				identity.map(i -> i.email).orElse(null));
	}

	public User resolve(Claims claims, Long linkUser) {
		try {
			return transactions.execute(status -> resolveInTransaction(claims, linkUser));
		} catch (DataIntegrityViolationException conflict) {
			// The failed transaction has rolled back, including any new user.
			return transactions.execute(status -> {
				var existing = identities.findByProviderAndSubject("GOOGLE", claims.subject());
				if (existing.isPresent() && (linkUser == null || existing.get().userId.equals(linkUser)))
					return linkUser == null ? signIn(existing.get().userId) : active(existing.get().userId);
				throw new IllegalArgumentException(
						"Sign in using your existing method, then connect Google in Settings.");
			});
		}
	}

	private User resolveInTransaction(Claims claims, Long linkUser) {
		User target = linkUser == null ? null : users.lockById(linkUser).orElseThrow();
		if (target != null)
			active(target.getId());
		var existing = identities.findByProviderAndSubject("GOOGLE", claims.subject());
		if (existing.isPresent()) {
			if (target != null && !existing.get().userId.equals(target.getId()))
				throw new IllegalArgumentException("Google cannot be connected to this account.");
			existing.get().email = claims.email();
			existing.get().updatedAt = java.time.Instant.now();
			identities.save(existing.get());
			return linkUser == null ? signIn(existing.get().userId) : active(existing.get().userId);
		}
		if (target != null && identities.findByUserIdAndProvider(target.getId(), "GOOGLE").isPresent())
			throw new IllegalArgumentException("A different Google account is already connected.");
		if (target == null) {
			if (users.existsByEmailIgnoreCase(claims.email()) || users.existsByUsernameIgnoreCase(claims.email()))
				throw new IllegalArgumentException(
						"Sign in using your existing method, then connect Google in Settings.");
			target = new User();
			target.setUsername("google_" + UUID.randomUUID().toString().replace("-", ""));
			target.setDisplayName(claims.name() == null || claims.name().isBlank() ? "Google user"
					: claims.name().strip().substring(0, Math.min(100, claims.name().strip().length())));
			target.setEmail(claims.email());
			target.setPasswordLoginEnabled(false);
			target.setPasswordHash(passwords.encode(UUID.randomUUID().toString() + UUID.randomUUID()));
			target = users.saveAndFlush(target);
		}
		GoogleIdentity identity = new GoogleIdentity();
		identity.userId = target.getId();
		identity.subject = claims.subject();
		identity.email = claims.email();
		identities.saveAndFlush(identity);
		return target;
	}

	public void unlink(String username, String password) {
		User proof = reauthenticate(username, password);
		transactions.executeWithoutResult(status -> {
			User user = users.lockById(proof.getId()).orElseThrow();
			active(user.getId());
			if (!user.isPasswordLoginEnabled())
				throw new IllegalArgumentException("Keep at least one usable sign-in method.");
			identities.findByUserIdAndProvider(user.getId(), "GOOGLE").ifPresent(identities::delete);
		});
	}
}
