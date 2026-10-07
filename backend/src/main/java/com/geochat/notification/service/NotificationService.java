package com.geochat.notification.service;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
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
	private static final int MAX_PAGE_SIZE = 50;

	private final NotificationRepository notificationRepository;
	private final UserRepository userRepository;

	public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository) {
		this.notificationRepository = notificationRepository;
		this.userRepository = userRepository;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public NotificationResponse createFriendRequestReceived(Long recipientId, Long requestId,
			String senderDisplayName) {
		return toResponse(createNotification(recipientId, NotificationType.FRIEND_REQUEST_RECEIVED,
				NotificationReferenceType.FRIEND_REQUEST, requestId, null, "Friend request",
				buildFriendRequestReceivedMessage(senderDisplayName)));
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public NotificationResponse createFriendRequestAccepted(Long recipientId, Long requestId,
			String accepterDisplayName) {
		return toResponse(createNotification(recipientId, NotificationType.FRIEND_REQUEST_ACCEPTED,
				NotificationReferenceType.FRIEND_REQUEST, requestId, null, "Friend request accepted",
				buildFriendRequestAcceptedMessage(accepterDisplayName)));
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public NotificationResponse createNewMessage(Long recipientId, Long messageId, Long conversationId,
			String senderDisplayName) {
		return toResponse(createNotification(recipientId, NotificationType.NEW_MESSAGE,
				NotificationReferenceType.MESSAGE, messageId, conversationId, "New message",
				buildNewMessageMessage(senderDisplayName)));
	}

	@Transactional(readOnly = true)
	public String getRecipientUsername(Long recipientId) {
		return userRepository.findById(recipientId)
				.orElseThrow(() -> new EntityNotFoundException("User not found"))
				.getUsername();
	}

	@Transactional(readOnly = true)
	public NotificationListResponse listNotifications(String username, int limit, int offset) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		List<Notification> notifications = notificationRepository
				.findPageByRecipientId(currentUser.getId(), limit, offset);
		long total = notificationRepository.countByRecipientId(currentUser.getId());
		long unreadCount = notificationRepository.countByRecipientIdAndReadFalse(currentUser.getId());
		return new NotificationListResponse(notifications.stream().map(this::toResponse).toList(), unreadCount, total,
				limit, offset, (long) offset + notifications.size() < total);
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
		notificationRepository.markAllAsRead(currentUser.getId(), Instant.now());
		return listNotifications(username, MAX_PAGE_SIZE, 0);
	}

	private Notification createNotification(Long recipientId, NotificationType type,
			NotificationReferenceType referenceType, Long referenceId, Long conversationId, String title, String message) {
		Notification notification = new Notification();
		notification.setRecipientId(recipientId);
		notification.setType(type);
		notification.setReferenceType(referenceType);
		notification.setReferenceId(referenceId);
		notification.setConversationId(conversationId);
		notification.setTitle(title);
		notification.setMessage(message);
		notification.setRead(false);
		notification.setCreatedAt(Instant.now());
		return notificationRepository.save(notification);
	}

	private NotificationResponse toResponse(Notification notification) {
		return new NotificationResponse(notification.getId(), notification.getRecipientId(), notification.getType(),
				notification.getTitle(), notification.getMessage(), notification.getReferenceType(),
			notification.getReferenceId(), notification.getConversationId(), notification.isRead(), notification.getCreatedAt(),
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
