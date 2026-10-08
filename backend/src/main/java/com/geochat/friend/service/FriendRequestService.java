package com.geochat.friend.service;

import com.geochat.friend.dto.CreateFriendRequestRequest;
import com.geochat.friend.dto.FriendListResponse;
import com.geochat.friend.dto.FriendRequestItemResponse;
import com.geochat.friend.dto.FriendRequestListResponse;
import com.geochat.friend.dto.FriendRequestResponse;
import com.geochat.friend.dto.UserSummaryResponse;
import com.geochat.friend.entity.FriendRequest;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.notification.event.FriendRequestAcceptedEvent;
import com.geochat.notification.event.FriendRequestCreatedEvent;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class FriendRequestService {

    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher applicationEventPublisher;

    public FriendRequestService(FriendRequestRepository friendRequestRepository,
                                UserRepository userRepository,
                                ApplicationEventPublisher applicationEventPublisher) {
        this.friendRequestRepository = friendRequestRepository;
        this.userRepository = userRepository;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @Transactional
    public FriendRequestResponse createFriendRequest(String username, CreateFriendRequestRequest request) {
        User sender = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        Long targetUserId = request.userId();
        if (targetUserId == null) {
            throw new IllegalArgumentException("User ID is required");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new EntityNotFoundException("Target user not found"));

        if (sender.getId().equals(targetUser.getId())) {
            throw new IllegalArgumentException("You cannot send a friend request to yourself");
        }

        if (areFriends(sender.getId(), targetUser.getId())) {
            throw new IllegalArgumentException("Users are already friends");
        }

        boolean pendingAlreadyExists = friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(
                sender.getId(), targetUser.getId(), FriendRequestStatus.PENDING)
                || friendRequestRepository.existsByReceiverIdAndSenderIdAndStatus(
                sender.getId(), targetUser.getId(), FriendRequestStatus.PENDING);

        if (pendingAlreadyExists) {
            throw new IllegalArgumentException("Friend request already exists");
        }

        FriendRequest friendRequest = new FriendRequest();
        friendRequest.setSenderId(sender.getId());
        friendRequest.setReceiverId(targetUser.getId());
        friendRequest.setStatus(FriendRequestStatus.PENDING);
        friendRequest.setCreatedAt(Instant.now());
        friendRequest.setUpdatedAt(Instant.now());

        FriendRequest saved = friendRequestRepository.save(friendRequest);
        applicationEventPublisher.publishEvent(new FriendRequestCreatedEvent(
                saved.getId(),
                saved.getReceiverId(),
                saved.getSenderId(),
                sender.getDisplayName()
        ));

        return toResponse(saved);
    }

    @Transactional
    public FriendRequestResponse acceptRequest(String username, Long requestId) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new EntityNotFoundException("Friend request not found"));

        if (!request.getReceiverId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You are not allowed to modify this request");
        }
        if (request.getStatus() != FriendRequestStatus.PENDING) {
            throw new IllegalArgumentException("Friend request is not pending");
        }

        request.setStatus(FriendRequestStatus.ACCEPTED);
        request.setUpdatedAt(Instant.now());

        FriendRequest saved = friendRequestRepository.save(request);
        applicationEventPublisher.publishEvent(new FriendRequestAcceptedEvent(
                saved.getId(),
                saved.getSenderId(),
                currentUser.getId(),
                currentUser.getDisplayName()
        ));

        return toResponse(saved);
    }

    @Transactional
    public FriendRequestResponse rejectRequest(String username, Long requestId) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new EntityNotFoundException("Friend request not found"));

        if (!request.getReceiverId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You are not allowed to modify this request");
        }
        if (request.getStatus() != FriendRequestStatus.PENDING) {
            throw new IllegalArgumentException("Friend request is not pending");
        }

        request.setStatus(FriendRequestStatus.REJECTED);
        request.setUpdatedAt(Instant.now());

        return toResponse(friendRequestRepository.save(request));
    }

    @Transactional
    public FriendRequestResponse cancelRequest(String username, Long requestId) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new EntityNotFoundException("Friend request not found"));

        if (!request.getSenderId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You are not allowed to modify this request");
        }
        if (request.getStatus() != FriendRequestStatus.PENDING) {
            throw new IllegalArgumentException("Friend request is not pending");
        }

        request.setStatus(FriendRequestStatus.CANCELLED);
        request.setUpdatedAt(Instant.now());

        return toResponse(friendRequestRepository.save(request));
    }

    @Transactional(readOnly = true)
    public FriendRequestListResponse getIncomingFriendRequests(String username) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        List<FriendRequestItemResponse> items = new ArrayList<>();
        for (FriendRequest request : friendRequestRepository.findByReceiverIdAndStatusOrderByCreatedAtDesc(
                currentUser.getId(), FriendRequestStatus.PENDING)) {
            User sender = userRepository.findById(request.getSenderId())
                    .orElseThrow(() -> new EntityNotFoundException("Sender user not found"));
            items.add(new FriendRequestItemResponse(
                    request.getId(),
                    new UserSummaryResponse(sender.getId(), sender.getUsername(), sender.getDisplayName()),
                    request.getCreatedAt()));
        }

        return new FriendRequestListResponse(items);
    }

    @Transactional(readOnly = true)
    public FriendRequestListResponse getOutgoingFriendRequests(String username) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        List<FriendRequestItemResponse> items = new ArrayList<>();
        for (FriendRequest request : friendRequestRepository.findBySenderIdAndStatusOrderByCreatedAtDesc(
                currentUser.getId(), FriendRequestStatus.PENDING)) {
            User receiver = userRepository.findById(request.getReceiverId())
                    .orElseThrow(() -> new EntityNotFoundException("Receiver user not found"));
            items.add(new FriendRequestItemResponse(
                    request.getId(),
                    new UserSummaryResponse(receiver.getId(), receiver.getUsername(), receiver.getDisplayName()),
                    request.getCreatedAt()));
        }

        return new FriendRequestListResponse(items);
    }

    @Transactional(readOnly = true)
    public FriendListResponse getFriends(String username) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        Map<Long, User> friendsById = new LinkedHashMap<>();
        addAcceptedFriends(currentUser.getId(), friendsById, true);
        addAcceptedFriends(currentUser.getId(), friendsById, false);

        return new FriendListResponse(friendsById.entrySet().stream()
            .map(entry -> new com.geochat.friend.dto.FriendSummaryResponse(
                entry.getKey(), entry.getValue().getUsername(), entry.getValue().getDisplayName()))
                .toList());
    }

    @Transactional
    public void removeFriend(String username, Long friendId) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        if (friendId == null || currentUser.getId().equals(friendId)) {
            throw new IllegalArgumentException("A different friend ID is required");
        }

        userRepository.findById(friendId)
                .orElseThrow(() -> new EntityNotFoundException("Friend not found"));
        if (!friendRequestRepository.areFriends(currentUser.getId(), friendId)) {
            throw new IllegalArgumentException("Users are not friends");
        }

        friendRequestRepository.deleteBySenderIdAndReceiverIdAndStatus(
                currentUser.getId(), friendId, FriendRequestStatus.ACCEPTED);
        friendRequestRepository.deleteBySenderIdAndReceiverIdAndStatus(
                friendId, currentUser.getId(), FriendRequestStatus.ACCEPTED);
    }

        private void addAcceptedFriends(Long currentUserId, Map<Long, User> friendsById, boolean asSender) {
        List<FriendRequest> requests = asSender
                ? friendRequestRepository.findBySenderIdAndStatusOrderByCreatedAtDesc(currentUserId, FriendRequestStatus.ACCEPTED)
                : friendRequestRepository.findByReceiverIdAndStatusOrderByCreatedAtDesc(currentUserId, FriendRequestStatus.ACCEPTED);

        for (FriendRequest request : requests) {
            Long friendId = asSender ? request.getReceiverId() : request.getSenderId();
            if (!friendId.equals(currentUserId)) {
                userRepository.findById(friendId).ifPresent(user -> friendsById.putIfAbsent(user.getId(), user));
            }
        }
    }

    private boolean areFriends(Long firstUserId, Long secondUserId) {
        return friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(firstUserId, secondUserId, FriendRequestStatus.ACCEPTED)
                || friendRequestRepository.existsByReceiverIdAndSenderIdAndStatus(firstUserId, secondUserId, FriendRequestStatus.ACCEPTED)
                || friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(secondUserId, firstUserId, FriendRequestStatus.ACCEPTED)
                || friendRequestRepository.existsByReceiverIdAndSenderIdAndStatus(secondUserId, firstUserId, FriendRequestStatus.ACCEPTED);
    }

    private FriendRequestResponse toResponse(FriendRequest request) {
        return new FriendRequestResponse(
                request.getId(),
                request.getSenderId(),
                request.getReceiverId(),
                request.getStatus(),
                request.getCreatedAt(),
                request.getUpdatedAt()
        );
    }
}
