package com.geochat.user.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.geochat.chat.service.ImageStorage;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.user.dto.PublicProfileResponse;
import com.geochat.user.dto.RegisterRequest;
import com.geochat.user.dto.UpdateMyProfileRequest;
import com.geochat.user.dto.UserResponse;
import com.geochat.user.dto.UserSearchResponse;
import com.geochat.user.dto.UserSearchResult;
import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;
import com.geochat.user.repository.UserRepository;

@Service
public class UserService {

	private static final int MAX_SEARCH_RESULTS = 20;

	private final UserRepository userRepository;
	private final FriendRequestRepository friendRequestRepository;
	private final PasswordEncoder passwordEncoder;
	private final ImageStorage imageStorage;

	public UserService(UserRepository userRepository, FriendRequestRepository friendRequestRepository,
			PasswordEncoder passwordEncoder, ImageStorage imageStorage) {
		this.userRepository = userRepository;
		this.friendRequestRepository = friendRequestRepository;
		this.passwordEncoder = passwordEncoder;
		this.imageStorage = imageStorage;
	}

	@Transactional(readOnly = true)
	public PublicProfileResponse publicProfile(Long id) {
		var user = userRepository.findById(id).filter(item -> item.getStatus() == UserStatus.ACTIVE)
				.orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Profile unavailable"));
		return PublicProfileResponse.from(user);
	}

	@Transactional
	public UserResponse register(RegisterRequest request) {
		String username = request.username().trim();
		String displayName = request.displayName().trim();

		if (userRepository.existsByUsernameIgnoreCase(username)) {
			throw new IllegalArgumentException("Username already exists");
		}

		User user = new User();
		user.setUsername(username);
		user.setPasswordHash(passwordEncoder.encode(request.password()));
		user.setDisplayName(displayName);
		user.setStatus(UserStatus.ACTIVE);
		user.setCreatedAt(Instant.now());
		user.setUpdatedAt(Instant.now());

		User saved = userRepository.save(user);
		return UserResponse.from(saved);
	}

	@Transactional(readOnly = true)
	public UserResponse getCurrentUser(String username) {
		User user = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new IllegalArgumentException("User not found"));
		return UserResponse.from(user);
	}

	@Transactional
	public UserResponse updateCurrentUser(String username, UpdateMyProfileRequest request) {
		User user = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new IllegalArgumentException("User not found"));
		String email = normalizeOptional(request.email());
		if (email != null && userRepository.existsByEmailIgnoreCaseAndIdNot(email, user.getId()))
			throw new com.geochat.user.exception.EmailAlreadyUsedException();
		user.setDisplayName(request.displayName().trim());
		if (request.email() != null)
			user.setEmail(email);
		if (request.phoneNumber() != null)
			user.setPhoneNumber(normalizePhone(request.phoneNumber()));
		user.setUpdatedAt(Instant.now());
		try {
			return UserResponse.from(userRepository.saveAndFlush(user));
		} catch (org.springframework.dao.DataIntegrityViolationException conflict) {
			// The database uniqueness constraint also protects simultaneous updates.
			for (Throwable cause = conflict; cause != null; cause = cause.getCause()) {
				if (cause instanceof org.hibernate.exception.ConstraintViolationException constraint
						&& constraint.getConstraintName() != null
						&& constraint.getConstraintName().toLowerCase(java.util.Locale.ROOT).contains("uq_users_email_ci"))
					throw new com.geochat.user.exception.EmailAlreadyUsedException();
			}
			throw conflict;
		}
	}

	@Transactional
	public UserResponse updateAvatar(String username, MultipartFile image) {
		User user = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new IllegalArgumentException("User not found"));
		var stored = imageStorage.store(image);
		String previous = user.getAvatarStorageKey();
		user.setAvatarStorageKey(stored.key());
		user.setAvatarContentType(stored.contentType());
		user.setAvatarUpdatedAt(Instant.now());
		user.setUpdatedAt(Instant.now());
		UserResponse response = UserResponse.from(userRepository.saveAndFlush(user));
		if (previous != null)
			try {
				imageStorage.delete(previous);
			} catch (RuntimeException ignored) {
			}
		return response;
	}

	@Transactional(readOnly = true)
	public AvatarData avatar(Long userId) {
		User user = userRepository.findById(userId)
				.filter(item -> item.getStatus() == UserStatus.ACTIVE && item.getAvatarStorageKey() != null)
				.orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Avatar unavailable"));
		return new AvatarData(imageStorage.read(user.getAvatarStorageKey()), user.getAvatarContentType());
	}

	public record AvatarData(byte[] bytes, String contentType) {
	}

	private String normalizeOptional(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	private String normalizePhone(String value) {
		String phone = normalizeOptional(value);
		if (phone != null && !phone.matches("^[+]?[0-9 ()-]{7,32}$"))
			throw new IllegalArgumentException("Phone number is invalid");
		return phone;
	}

	@Transactional(readOnly = true)
	public UserSearchResponse searchUsers(String currentUsername, String query) {
		return searchUsers(currentUsername, query, 0);
	}

	@Transactional(readOnly = true)
	public UserSearchResponse searchUsers(String currentUsername, String query, int page) {
		String normalizedQuery = query == null ? "" : query.trim();

		if (normalizedQuery.isBlank()) {
			throw new IllegalArgumentException("Search query is required");
		}
		if (normalizedQuery.length() < 2) {
			throw new IllegalArgumentException("Search query must be at least 2 characters");
		}
		if (normalizedQuery.length() > 100) {
			throw new IllegalArgumentException("Search query must be at most 100 characters");
		}
		if (page < 0 || page > 49) {
			throw new IllegalArgumentException("Search page must be between 0 and 49");
		}

		User currentUser = userRepository.findByUsernameIgnoreCase(currentUsername)
				.orElseThrow(() -> new IllegalArgumentException("User not found"));

		var searchPage = userRepository.searchUsers(currentUser.getId(), normalizedQuery,
				PageRequest.of(page, MAX_SEARCH_RESULTS));
		List<User> users = searchPage.getContent();
		boolean hasMore = searchPage.hasNext();
		List<Long> userIds = users.stream().map(User::getId).toList();
		Map<Long, com.geochat.friend.entity.FriendRequest> relationships = userIds.isEmpty() ? Map.of()
				: friendRequestRepository
						.findRelationships(currentUser.getId(), userIds,
								List.of(FriendRequestStatus.PENDING, FriendRequestStatus.ACCEPTED))
						.stream()
						.collect(Collectors.toMap(
								request -> request.getSenderId().equals(currentUser.getId()) ? request.getReceiverId()
										: request.getSenderId(),
								Function.identity(), (first, ignored) -> first));

		List<UserSearchResult> items = users.stream().map(user -> {
			var relationship = relationships.get(user.getId());
			String state = relationship == null ? "NONE"
					: relationship.getStatus() == FriendRequestStatus.ACCEPTED ? "FRIENDS"
							: relationship.getSenderId().equals(currentUser.getId()) ? "PENDING_OUTGOING"
									: "PENDING_INCOMING";
			return new UserSearchResult(user.getId(), user.getDisplayName(), user.getUsername(), state,
					relationship != null && relationship.getStatus() == FriendRequestStatus.PENDING
							? relationship.getId()
							: null);
		}).toList();

		return new UserSearchResponse(items, page, hasMore);
	}
}
