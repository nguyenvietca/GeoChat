package com.geochat.notification.service;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.geochat.notification.dto.NotificationListResponse;
import com.geochat.notification.dto.NotificationResponse;
import com.geochat.notification.dto.UnreadCountResponse;
import com.geochat.notification.entity.Notification;
import com.geochat.notification.enumtype.NotificationReferenceType;
import com.geochat.notification.enumtype.NotificationType;
import com.geochat.notification.repository.NotificationRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;

import jakarta.persistence.EntityNotFoundException;

@Service
public class NotificationService {

	private final NotificationRepository notificationRepository;
	private final UserRepository userRepository;

	public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository) {
		this.notificationRepository = notificationRepository;
		this.userRepository = userRepository;
	}

	@Transactional
	public NotificationResponse createFriendRequestReceived(Long recipientId, Long requestId,
			String senderDisplayName) {
		return toResponse(createNotification(recipientId, NotificationType.FRIEND_REQUEST_RECEIVED,
				NotificationReferenceType.FRIEND_REQUEST, requestId, "Friend request",
				buildFriendRequestReceivedMessage(senderDisplayName)));
	}

	@Transactional
	public NotificationResponse createFriendRequestAccepted(Long recipientId, Long requestId,
			String accepterDisplayName) {
		return toResponse(createNotification(recipientId, NotificationType.FRIEND_REQUEST_ACCEPTED,
				NotificationReferenceType.FRIEND_REQUEST, requestId, "Friend request accepted",
				buildFriendRequestAcceptedMessage(accepterDisplayName)));
	}

	@Transactional
	public NotificationResponse createNewMessage(Long recipientId, Long messageId, String senderDisplayName) {
		return toResponse(
				createNotification(recipientId, NotificationType.NEW_MESSAGE, NotificationReferenceType.MESSAGE,
						messageId, "New message", buildNewMessageMessage(senderDisplayName)));
	}

	@Transactional(readOnly = true)
	public NotificationListResponse listNotifications(String username) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		List<Notification> notifications = notificationRepository
				.findByRecipientIdOrderByCreatedAtDesc(currentUser.getId());
		long unreadCount = notificationRepository.countByRecipientIdAndReadFalse(currentUser.getId());
		return new NotificationListResponse(notifications.stream().map(this::toResponse).toList(), unreadCount);
	}

	@Transactional(readOnly = true)
	public UnreadCountResponse getUnreadCount(String username) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));
		return new UnreadCountResponse(notificationRepository.countByRecipientIdAndReadFalse(currentUser.getId()));
	}

	@Transactional
	public NotificationResponse markAsRead(String username, Long notificationId) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		Notification notification = notificationRepository.findByIdAndRecipientId(notificationId, currentUser.getId())
				.orElseThrow(() -> new EntityNotFoundException("Notification not found"));

		if (!notification.isRead()) {
			notification.setRead(true);
			notification.setReadAt(Instant.now());
			notification = notificationRepository.save(notification);
		}

		return toResponse(notification);
	}

	@Transactional
	public NotificationListResponse markAllAsRead(String username) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		List<Notification> notifications = notificationRepository
				.findByRecipientIdOrderByCreatedAtDesc(currentUser.getId());
		notifications.stream().filter(notification -> !notification.isRead()).forEach(notification -> {
			notification.setRead(true);
			notification.setReadAt(Instant.now());
		});

		if (!notifications.isEmpty()) {
			notificationRepository.saveAll(notifications.stream()
					.filter(notification -> !notification.isRead() || notification.getReadAt() != null).toList());
		}

		return listNotifications(username);
	}

	private Notification createNotification(Long recipientId, NotificationType type,
			NotificationReferenceType referenceType, Long referenceId, String title, String message) {
		Notification notification = new Notification();
		notification.setRecipientId(recipientId);
		notification.setType(type);
		notification.setReferenceType(referenceType);
		notification.setReferenceId(referenceId);
		notification.setTitle(title);
		notification.setMessage(message);
		notification.setRead(false);
		notification.setCreatedAt(Instant.now());
		return notificationRepository.save(notification);
	}

	private NotificationResponse toResponse(Notification notification) {
		return new NotificationResponse(notification.getId(), notification.getRecipientId(), notification.getType(),
				notification.getTitle(), notification.getMessage(), notification.getReferenceType(),
				notification.getReferenceId(), notification.isRead(), notification.getCreatedAt(),
				notification.getReadAt());
	}

	private String buildFriendRequestReceivedMessage(String senderDisplayName) {
		return senderDisplayName + " sent you a friend request.";
	}

	private String buildFriendRequestAcceptedMessage(String accepterDisplayName) {
		return accepterDisplayName + " accepted your friend request.";
	}

	private String buildNewMessageMessage(String senderDisplayName) {
		return senderDisplayName + " sent you a new message.";
	}
}
