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
// Shared identity service; the original class name is retained for Google compatibility.
public class GoogleAccounts {
	private final UserRepository users;
	private final GoogleIdentityRepository identities;
	private final PasswordEncoder passwords;
	private final TransactionTemplate transactions;
	private final GoogleSettings google;
	private final FacebookSettings facebook;

	public GoogleAccounts(UserRepository users, GoogleIdentityRepository identities, PasswordEncoder passwords,
			org.springframework.transaction.PlatformTransactionManager manager, GoogleSettings google,
			FacebookSettings facebook) {
		this.users = users;
		this.identities = identities;
		this.passwords = passwords;
		this.transactions = new TransactionTemplate(manager);
		this.google = google;
		this.facebook = facebook;
	}

	public record Claims(String provider, String subject, String email, boolean verified, String name) {
		public Claims(String subject, String email, boolean verified, String name) {
			this("GOOGLE", subject, email, verified, name);
		}

		public Claims {
			if (subject == null || subject.isBlank() || subject.length() > 255
					|| !("GOOGLE".equals(provider) || "FACEBOOK".equals(provider))
					|| ("GOOGLE".equals(provider) && (!verified || email == null || email.isBlank()))
					|| (email != null && email.length() > 320))
				throw new IllegalArgumentException("Provider identity could not be verified.");
			if ("FACEBOOK".equals(provider))
				verified = false;
			email = email == null || email.isBlank() ? null : email.trim().toLowerCase(Locale.ROOT);
		}
	}

	public record Connections(boolean passwordAvailable, boolean googleConnected, String email,
			boolean facebookConnected) {
	}

	public User active(Long id) {
		User user = signIn(id);
		if (user.getStatus() != UserStatus.ACTIVE)
			throw new org.springframework.security.access.AccessDeniedException(
					"Activate your account before continuing.");
		return user;
	}

	private User signIn(Long id) {
		User user = users.findById(id).orElseThrow(() -> new BadCredentialsException("Account unavailable."));
		if (user.getStatus() == UserStatus.LOCKED)
			throw new org.springframework.security.access.AccessDeniedException(
					"This account is blocked. Contact an administrator.");
		return user;
	}

	public User existingIdentity(Claims claims) {
		var identity = identities.findByProviderAndSubject(claims.provider(), claims.subject())
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
		return connections(username, "GOOGLE");
	}

	public Connections connections(String username, String provider) {
		User user = users.findByUsernameIgnoreCase(username).orElseThrow();
		active(user.getId());
		var identity = identities.findByUserIdAndProvider(user.getId(), provider);
		return new Connections(user.isPasswordLoginEnabled(), "GOOGLE".equals(provider) && identity.isPresent(),
				identity.map(i -> i.email).orElse(null), "FACEBOOK".equals(provider) && identity.isPresent());
	}

	public User resolve(Claims claims, Long linkUser) {
		return resolve(claims, linkUser, null);
	}

	public User resolve(Claims claims, Long linkUser, Long authVersion) {
		try {
			return transactions.execute(status -> resolveInTransaction(claims, linkUser, authVersion));
		} catch (DataIntegrityViolationException conflict) {
			// The failed transaction has rolled back, including any new user.
			return transactions.execute(status -> {
				if (linkUser != null)
					checkLinkSession(users.lockById(linkUser).orElseThrow(), authVersion);
				var existing = identities.findByProviderAndSubject(claims.provider(), claims.subject());
				if (existing.isPresent() && (linkUser == null || existing.get().userId.equals(linkUser)))
					return linkUser == null ? signIn(existing.get().userId) : active(existing.get().userId);
				throw new IllegalArgumentException(
						"Sign in using your existing method, then connect the provider in Settings.");
			});
		}
	}

	private void checkLinkSession(User user, Long version) {
		active(user.getId());
		if (version != null && user.getAuthVersion() != version)
			throw new org.springframework.security.access.AccessDeniedException("Sign in again.");
	}

	private User resolveInTransaction(Claims claims, Long linkUser, Long authVersion) {
		User target = linkUser == null ? null : users.lockById(linkUser).orElseThrow();
		if (target != null)
			checkLinkSession(target, authVersion);
		var existing = identities.findByProviderAndSubject(claims.provider(), claims.subject());
		if (existing.isPresent()) {
			if (target != null && !existing.get().userId.equals(target.getId()))
				throw new IllegalArgumentException("This identity cannot be connected to this account.");
			existing.get().email = claims.email();
			existing.get().updatedAt = java.time.Instant.now();
			identities.save(existing.get());
			return linkUser == null ? signIn(existing.get().userId) : active(existing.get().userId);
		}
		if (target != null && identities.findByUserIdAndProvider(target.getId(), claims.provider()).isPresent())
			throw new IllegalArgumentException("A different identity from this provider is already connected.");
		if (target == null) {
			if (claims.email() != null && (users.existsByEmailIgnoreCase(claims.email())
					|| users.existsByUsernameIgnoreCase(claims.email())))
				throw new IllegalArgumentException(
						"Sign in using your existing method, then connect the provider in Settings.");
			target = new User();
			target.setUsername(
					claims.provider().toLowerCase(Locale.ROOT) + "_" + UUID.randomUUID().toString().replace("-", ""));
			target.setDisplayName(claims.name() == null || claims.name().isBlank()
					? ("FACEBOOK".equals(claims.provider()) ? "Facebook user" : "Google user")
					: claims.name().strip().substring(0, Math.min(100, claims.name().strip().length())));
			// Facebook email is metadata, never a verified recovery address.
			target.setEmail(claims.verified() ? claims.email() : null);
			target.setPasswordLoginEnabled(false);
			target.setPasswordHash(passwords.encode(UUID.randomUUID().toString() + UUID.randomUUID()));
			target = users.saveAndFlush(target);
		}
		GoogleIdentity identity = new GoogleIdentity();
		identity.provider = claims.provider();
		identity.userId = target.getId();
		identity.subject = claims.subject();
		identity.email = claims.email();
		identities.saveAndFlush(identity);
		return target;
	}

	public void unlink(String username, String password) {
		unlink(username, password, "GOOGLE");
	}

	public void unlink(String username, String password, String provider) {
		User proof = reauthenticate(username, password);
		unlinkVerified(proof.getId(), provider, proof.getAuthVersion());
	}

	public void unlinkVerified(Long id, String provider) {
		unlinkVerified(id, provider, null);
	}

	public void unlinkVerified(Long id, String provider, Long authVersion) {
		transactions.executeWithoutResult(status -> {
			User user = users.lockById(id).orElseThrow();
			checkLinkSession(user, authVersion);
			String other = "GOOGLE".equals(provider) ? "FACEBOOK" : "GOOGLE";
			boolean otherEnabled = "GOOGLE".equals(other) ? google.enabled : facebook.enabled;
			if (!user.isPasswordLoginEnabled()
					&& (!otherEnabled || identities.findByUserIdAndProvider(id, other).isEmpty()))
				throw new IllegalArgumentException("Keep at least one usable sign-in method.");
			identities.findByUserIdAndProvider(user.getId(), provider).ifPresent(identities::delete);
		});
	}
}
