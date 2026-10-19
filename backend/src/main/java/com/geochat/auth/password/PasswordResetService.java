package com.geochat.auth.password;

import com.geochat.user.entity.*;
import com.geochat.user.repository.UserRepository;
import com.geochat.user.service.AccountLifecycleService.AccessChanged;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

@Service
public class PasswordResetService {
	private final UserRepository users;
	private final PasswordResetTokens tokens;
	private final PasswordEncoder passwords;
	private final PasswordResetMail mail;
	private final ApplicationEventPublisher events;
	private final TransactionTemplate tx;
	private final String webOrigin;
	private final boolean enabled;
	private final com.geochat.common.security.SlidingRequestLimits limits = new com.geochat.common.security.SlidingRequestLimits();
	private final ThreadPoolExecutor queue = new ThreadPoolExecutor(1, 2, 30, TimeUnit.SECONDS,
			new ArrayBlockingQueue<>(32), task -> {
				Thread t = new Thread(task, "password-reset-mail");
				t.setDaemon(true);
				return t;
			});

	public PasswordResetService(UserRepository users, PasswordResetTokens tokens, PasswordEncoder passwords,
			PasswordResetMail mail, ApplicationEventPublisher events, PlatformTransactionManager manager,
			@Value("${app.password-reset.enabled:false}") boolean enabled,
			@Value("${app.password-reset.web-origin:http://localhost:5173}") String webOrigin) {
		this.users = users;
		this.tokens = tokens;
		this.passwords = passwords;
		this.mail = mail;
		this.events = events;
		this.tx = new TransactionTemplate(manager);
		this.enabled = enabled;
		this.webOrigin = webOrigin.replaceAll("/$", "");
		var uri = java.net.URI.create(this.webOrigin);
		if (enabled && (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) || uri.getHost() == null
				|| uri.getRawQuery() != null || uri.getRawFragment() != null || uri.getUserInfo() != null
				|| (uri.getPath() != null && !uri.getPath().isEmpty())))
			throw new IllegalStateException("Password reset requires a valid Web origin.");
	}

	public boolean available() {
		return enabled && mail.available();
	}

	static String hash(String value) {
		try {
			return HexFormat.of()
					.formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException(ex);
		}
	}

	public void request(String email) {
		if (!available())
			throw new IllegalArgumentException("Password recovery is currently unavailable.");
		String normalized = email.strip().toLowerCase(Locale.ROOT);
		limits.check("reset-email:" + hash(normalized), 3, 900_000);
		// SMTP and account lookup run off-request for a neutral response and bounded
		// work.
		try {
			queue.execute(() -> issueAndSend(normalized));
		} catch (RejectedExecutionException busy) {
			/* Neutral response, no account-existence signal. */ }
	}

	private void issueAndSend(String email) {
		try {
			tx.executeWithoutResult(status -> tokens.deleteByExpiresAtBefore(Instant.now()));
			String raw = tx.execute(status -> {
				var found = users.findByEmailIgnoreCase(email);
				if (found.isEmpty())
					return null;
				User user = users.lockById(found.get().getId()).orElseThrow();
				if (!user.isPasswordLoginEnabled() || user.getStatus() == UserStatus.LOCKED)
					return null;
				byte[] bytes = new byte[32];
				new SecureRandom().nextBytes(bytes);
				String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
				tokens.deleteByUserId(user.getId());
				tokens.flush();
				PasswordResetToken row = new PasswordResetToken();
				row.userId = user.getId();
				row.email = email;
				row.authVersion = user.getAuthVersion();
				row.tokenHash = hash(token);
				row.expiresAt = Instant.now().plusSeconds(900);
				tokens.saveAndFlush(row);
				return token;
			});
			if (raw != null)
				mail.send(email, webOrigin + "/reset-password#token=" + raw);
		} catch (RuntimeException failure) {
			// Provider exceptions can include addresses or full messages; never log them.
			org.slf4j.LoggerFactory.getLogger(getClass()).warn("Password recovery delivery failed.");
		}
	}

	@Transactional
	public void reset(String raw, String password) {
		if (!available())
			throw new IllegalArgumentException("Password recovery is currently unavailable.");
		if (raw == null || !raw.matches("[A-Za-z0-9_-]{43}"))
			throw invalid();
		if (password == null || password.length() < 8 || password.isBlank()
				|| password.getBytes(StandardCharsets.UTF_8).length > 72)
			throw new IllegalArgumentException("Password must be between 8 and 72 UTF-8 bytes.");
		String hash = hash(raw);
		var found = tokens.findByTokenHash(hash).orElseThrow(PasswordResetService::invalid);
		User user = users.lockById(found.userId).orElseThrow(PasswordResetService::invalid);
		var proof = tokens.lockByHash(hash).orElseThrow(PasswordResetService::invalid);
		if (!proof.expiresAt.isAfter(Instant.now()) || user.getAuthVersion() != proof.authVersion
				|| !user.isPasswordLoginEnabled() || user.getStatus() == UserStatus.LOCKED || user.getEmail() == null
				|| !user.getEmail().equalsIgnoreCase(proof.email))
			throw invalid();
		user.setPasswordHash(passwords.encode(password));
		user.setAuthVersion(user.getAuthVersion() + 1);
		user.setUpdatedAt(Instant.now());
		users.saveAndFlush(user);
		tokens.deleteByUserId(user.getId());
		events.publishEvent(new AccessChanged(user.getId()));
	}

	private static IllegalArgumentException invalid() {
		return new IllegalArgumentException("Reset link is invalid or expired. Request a new link.");
	}

	@PreDestroy
	void close() {
		queue.shutdownNow();
	}
}
