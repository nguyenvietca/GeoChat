package com.geochat.user.service;

import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.user.dto.RegisterRequest;
import com.geochat.user.dto.UpdateMyProfileRequest;
import com.geochat.user.dto.UserResponse;
import com.geochat.user.dto.UserSearchResponse;
import com.geochat.user.dto.UserSearchResult;
import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;
import com.geochat.user.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class UserService {

    private static final int MAX_SEARCH_RESULTS = 20;

    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                      FriendRequestRepository friendRequestRepository,
                      PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.passwordEncoder = passwordEncoder;
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
        user.setDisplayName(request.displayName().trim());
        user.setUpdatedAt(Instant.now());
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public UserSearchResponse searchUsers(String currentUsername, String query) {
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

        User currentUser = userRepository.findByUsernameIgnoreCase(currentUsername)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<User> users = userRepository.searchUsers(currentUser.getId(), normalizedQuery, PageRequest.of(0, MAX_SEARCH_RESULTS));

        List<UserSearchResult> items = users.stream()
                .map(user -> new UserSearchResult(
                        user.getId(),
                        user.getDisplayName(),
                        user.getUsername(),
                        determineRelationship(currentUser.getId(), user.getId())))
                .toList();

        return new UserSearchResponse(items);
    }

    private String determineRelationship(Long currentUserId, Long otherUserId) {
        if (friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(currentUserId, otherUserId, FriendRequestStatus.ACCEPTED)
                || friendRequestRepository.existsByReceiverIdAndSenderIdAndStatus(currentUserId, otherUserId, FriendRequestStatus.ACCEPTED)) {
            return "FRIENDS";
        }
        if (friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(currentUserId, otherUserId, FriendRequestStatus.PENDING)) {
            return "PENDING_OUTGOING";
        }
        if (friendRequestRepository.existsByReceiverIdAndSenderIdAndStatus(currentUserId, otherUserId, FriendRequestStatus.PENDING)) {
            return "PENDING_INCOMING";
        }
        return "NONE";
    }
}
