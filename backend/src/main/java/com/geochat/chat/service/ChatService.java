package com.geochat.chat.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.geochat.chat.dto.ChatDtos.ConversationDetailResponse;
import com.geochat.chat.dto.ChatDtos.ConversationListResponse;
import com.geochat.chat.dto.ChatDtos.ConversationPresenceResponse;
import com.geochat.chat.dto.ChatDtos.ConversationSummaryResponse;
import com.geochat.chat.dto.ChatDtos.MessageListResponse;
import com.geochat.chat.dto.ChatDtos.MessageResponse;
import com.geochat.chat.dto.ChatDtos.OpenDirectChatResponse;
import com.geochat.chat.dto.ChatDtos.UserSummaryResponse;
import com.geochat.chat.dto.ChatDtos.UserPresenceResponse;
import com.geochat.chat.dto.OpenDirectChatRequest;
import com.geochat.chat.dto.OpenContextualChatRequest;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.entity.Conversation;
import com.geochat.chat.entity.ConversationParticipant;
import com.geochat.chat.entity.Message;
import com.geochat.chat.repository.ConversationParticipantRepository;
import com.geochat.chat.repository.ConversationRepository;
import com.geochat.chat.repository.MessageRepository;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.notification.event.MessageCreatedEvent;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import com.geochat.location.service.LocationService;
import com.geochat.chat.websocket.WebSocketSessionRegistry;

import jakarta.persistence.EntityNotFoundException;

@Service
public class ChatService {

	private final ConversationRepository conversationRepository;
	private final ConversationParticipantRepository conversationParticipantRepository;
	private final MessageRepository messageRepository;
	private final UserRepository userRepository;
	private final FriendRequestRepository friendRequestRepository;
	private final ApplicationEventPublisher applicationEventPublisher;
	private final LocationService locationService;
	private final WebSocketSessionRegistry webSocketSessionRegistry;
	private static final int CONTEXTUAL_MESSAGE_LIMIT = 5;

	public ChatService(ConversationRepository conversationRepository,
			ConversationParticipantRepository conversationParticipantRepository, MessageRepository messageRepository,
			UserRepository userRepository, FriendRequestRepository friendRequestRepository,
				ApplicationEventPublisher applicationEventPublisher, LocationService locationService,
				WebSocketSessionRegistry webSocketSessionRegistry) {
		this.conversationRepository = conversationRepository;
		this.conversationParticipantRepository = conversationParticipantRepository;
		this.messageRepository = messageRepository;
		this.userRepository = userRepository;
		this.friendRequestRepository = friendRequestRepository;
		this.applicationEventPublisher = applicationEventPublisher;
		this.locationService = locationService;
		this.webSocketSessionRegistry = webSocketSessionRegistry;
	}

	@Transactional
	public OpenDirectChatResponse openDirectConversation(String username, OpenDirectChatRequest request) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		Long otherUserId = request.userId();
		if (otherUserId == null) {
			throw new IllegalArgumentException("userId is required");
		}
		if (currentUser.getId().equals(otherUserId)) {
			throw new IllegalArgumentException("You cannot chat with yourself");
		}

		User otherUser = userRepository.findById(otherUserId)
				.orElseThrow(() -> new EntityNotFoundException("Target user not found"));

		if (!areFriends(currentUser.getId(), otherUserId)) {
			throw new IllegalArgumentException("Only friends can chat directly");
		}

		String conversationKey = buildConversationKey(currentUser.getId(), otherUserId);
		Conversation conversation = conversationRepository.findByTypeAndConversationKey("DIRECT", conversationKey)
				.or(() -> conversationRepository.findByTypeAndConversationKey("DIRECT", "LIMITED:" + conversationKey)
						.map(limited -> {
							limited.setContextualLimited(false);
							return conversationRepository.save(limited);
						}))
				.orElseGet(() -> {
					Conversation newConversation = new Conversation();
					newConversation.setType("DIRECT");
					newConversation.setConversationKey(conversationKey);
					newConversation.setCreatedAt(Instant.now());
					newConversation.setUpdatedAt(Instant.now());
					return conversationRepository.save(newConversation);
				});

		addParticipantIfMissing(conversation.getId(), currentUser.getId());
		addParticipantIfMissing(conversation.getId(), otherUserId);

		return new OpenDirectChatResponse(conversation.getId(), conversation.getType(), toUserSummary(otherUser));
	}

	@Transactional
	public OpenDirectChatResponse openContextualConversation(String username, OpenContextualChatRequest request) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));
		if (request.userId() == null || currentUser.getId().equals(request.userId())) {
			throw new IllegalArgumentException("A different userId is required");
		}
		User otherUser = userRepository.findById(request.userId())
				.orElseThrow(() -> new EntityNotFoundException("Target user not found"));
		if (areFriends(currentUser.getId(), otherUser.getId())) {
			return openDirectConversation(username, new OpenDirectChatRequest(otherUser.getId()));
		}

		String key = "LIMITED:" + buildConversationKey(currentUser.getId(), otherUser.getId());
		Conversation conversation = conversationRepository.findByTypeAndConversationKey("DIRECT", key).orElse(null);
		if (conversation == null) {
			boolean shareGroup = conversationParticipantRepository.shareGroup(currentUser.getId(), otherUser.getId());
			boolean nearby = locationService.isWithinRadius(username, otherUser.getId(), request.radiusMeters());
			if (!shareGroup && !nearby) {
				throw new AccessDeniedException("You can only message nearby people or members of your groups");
			}
			Instant now = Instant.now();
			conversation = new Conversation();
			conversation.setType("DIRECT");
			conversation.setConversationKey(key);
			conversation.setContextualLimited(true);
			conversation.setCreatedAt(now);
			conversation.setUpdatedAt(now);
			conversation = conversationRepository.save(conversation);
			addParticipantIfMissing(conversation.getId(), currentUser.getId());
			addParticipantIfMissing(conversation.getId(), otherUser.getId());
		}
		return new OpenDirectChatResponse(conversation.getId(), conversation.getType(), toUserSummary(otherUser));
	}

	@Transactional(readOnly = true)
	public ConversationListResponse listConversations(String username) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		List<ConversationSummaryResponse> items = new ArrayList<>();
		Map<Long, Integer> directIndexByUser = new java.util.HashMap<>();
		java.util.Set<Long> limitedConversationIds = new java.util.HashSet<>();
		List<ConversationParticipant> participants = conversationParticipantRepository
				.findByUserIdOrderByConversationIdDesc(currentUser.getId());

		for (ConversationParticipant participant : participants) {
			Conversation conversation = conversationRepository.findById(participant.getConversationId()).orElse(null);
			if (conversation == null) {
				continue;
			}
			List<ConversationParticipant> others = conversationParticipantRepository
					.findOtherParticipants(conversation.getId(), currentUser.getId());
			if (others.isEmpty()) {
				continue;
			}

			User otherUser = userRepository.findById(others.get(0).getUserId()).orElse(null);
			if (otherUser == null) {
				continue;
			}
			    ConversationSummaryResponse summary = new ConversationSummaryResponse(conversation.getId(),
				    conversation.getType(), toUserSummary(otherUser), conversation.getUpdatedAt(), null);
			if ("DIRECT".equals(conversation.getType())) {
				Integer existingIndex = directIndexByUser.get(otherUser.getId());
				if (existingIndex != null) {
					// Legacy duplicates: keep one entry per person, preferring the unlimited chat.
					if (limitedConversationIds.contains(items.get(existingIndex).conversationId())
							&& !conversation.isContextualLimited()) {
						items.set(existingIndex, summary);
					}
					continue;
				}
				directIndexByUser.put(otherUser.getId(), items.size());
				if (conversation.isContextualLimited()) {
					limitedConversationIds.add(conversation.getId());
				}
			}
			items.add(summary);
		}

			List<Long> conversationIds = items.stream().map(ConversationSummaryResponse::conversationId).toList();
			Map<Long, String> latestMessages = conversationIds.isEmpty() ? Map.of()
				: messageRepository.findLatestMessagesByConversationIds(conversationIds).stream()
					.collect(Collectors.toMap(Message::getConversationId, Message::getContent));
			List<ConversationSummaryResponse> summaries = items.stream()
				.map(item -> new ConversationSummaryResponse(item.conversationId(), item.type(), item.participant(),
					item.updatedAt(), latestMessages.get(item.conversationId())))
				.sorted(Comparator.comparing(ConversationSummaryResponse::updatedAt, Comparator.reverseOrder()))
				.toList();
			return new ConversationListResponse(summaries);
	}

	@Transactional(readOnly = true)
	public ConversationDetailResponse getConversationDetail(String username, Long conversationId) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		Conversation conversation = conversationRepository.findById(conversationId)
				.orElseThrow(() -> new EntityNotFoundException("Conversation not found"));

		if (!conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
			throw new AccessDeniedException("You are not a participant in this conversation");
		}

		List<UserSummaryResponse> participants = conversationParticipantRepository
				.findByConversationIdOrderByIdAsc(conversationId).stream()
				.map(participant -> userRepository.findById(participant.getUserId()).orElse(null))
				.filter(user -> user != null).map(this::toUserSummary).toList();

		Integer limitedMessagesRemaining = conversation.isContextualLimited()
				? Math.max(0, CONTEXTUAL_MESSAGE_LIMIT - (int) messageRepository.countByConversationId(conversationId))
				: null;
		return new ConversationDetailResponse(conversation.getId(), conversation.getType(), participants,
				conversation.getCreatedAt(), conversation.getUpdatedAt(), limitedMessagesRemaining);
	}

	@Transactional(readOnly = true)
	public ConversationPresenceResponse getConversationPresence(String username, Long conversationId) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));
		if (!conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
			throw new AccessDeniedException("You are not a participant in this conversation");
		}
		List<UserPresenceResponse> items = conversationParticipantRepository
				.findByConversationIdOrderByIdAsc(conversationId).stream()
				.map(participant -> new UserPresenceResponse(participant.getUserId(),
						webSocketSessionRegistry.isOnline(participant.getUserId())))
				.toList();
		return new ConversationPresenceResponse(items);
	}

	@Transactional(readOnly = true)
	public boolean canViewPresence(String username, Long targetUserId) {
		if (username == null || targetUserId == null) return false;
		User currentUser = userRepository.findByUsernameIgnoreCase(username).orElse(null);
		return currentUser != null
				&& conversationParticipantRepository.shareDirectConversation(currentUser.getId(), targetUserId);
	}

	@Transactional
	public MessageResponse sendMessage(String username, Long conversationId, SendMessageRequest request) {
		String content = normalizeContent(request == null ? null : request.content());
		return createPersistedMessage(username, conversationId, content);
	}

	@Transactional
	public MessageResponse sendMessageFromWebSocket(String username, Long conversationId, String rawContent) {
		String content = normalizeContent(rawContent);
		return createPersistedMessage(username, conversationId, content);
	}

	@Transactional(readOnly = true)
	public MessageListResponse listMessages(String username, Long conversationId, Integer limit) {
		return listMessages(username, conversationId, limit, 0);
	}

	@Transactional(readOnly = true)
	public MessageListResponse listMessages(String username, Long conversationId, Integer limit, Integer page) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		Conversation conversation = conversationRepository.findById(conversationId)
				.orElseThrow(() -> new EntityNotFoundException("Conversation not found"));
		if (conversation.isContextualLimited()) {
			conversation = conversationRepository.findByIdForUpdate(conversationId)
					.orElseThrow(() -> new EntityNotFoundException("Conversation not found"));
		}

		if (!conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
			throw new AccessDeniedException("You are not a participant in this conversation");
		}

		int safeLimit = limit == null || limit <= 0 ? 20 : Math.min(limit, 100);
        int safePage = page == null || page < 0 ? 0 : page;
		Pageable pageable = PageRequest.of(safePage, safeLimit);
		List<Message> messages = messageRepository.findByConversationIdOrderByCreatedAtDescIdDesc(
				conversation.getId(), pageable);

		List<MessageResponse> items = new ArrayList<>(messages.stream().map(message -> new MessageResponse(message.getId(),
				message.getConversationId(), message.getSenderId(), message.getContent(), message.getCreatedAt()))
				.toList());
		Collections.reverse(items);

		return new MessageListResponse(items, messageRepository.countByConversationId(conversation.getId()), safePage,
				safeLimit);
	}

	public boolean isParticipant(String username, Long conversationId) {
		if (conversationId == null || username == null || username.isBlank()) {
			return false;
		}

		User currentUser = userRepository.findByUsernameIgnoreCase(username).orElse(null);
		if (currentUser == null) {
			return false;
		}

		Conversation conversation = conversationRepository.findById(conversationId).orElse(null);
		if (conversation == null) {
			return false;
		}

		return conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId());
	}

	private MessageResponse createPersistedMessage(String username, Long conversationId, String content) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		Conversation conversation = conversationRepository.findById(conversationId)
				.orElseThrow(() -> new EntityNotFoundException("Conversation not found"));

		if (!conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
			throw new AccessDeniedException("You are not a participant in this conversation");
		}

		if (content == null || content.isBlank()) {
			throw new IllegalArgumentException("message content is required");
		}

		if (content.length() > 5000) {
			throw new IllegalArgumentException("message content must be at most 5000 characters");
		}
		if (conversation.isContextualLimited()
				&& messageRepository.countByConversationId(conversationId) >= CONTEXTUAL_MESSAGE_LIMIT) {
			throw new IllegalArgumentException("This conversation is limited to 5 messages. Add each other as friends to continue");
		}

		Message message = new Message();
		message.setConversationId(conversation.getId());
		message.setSenderId(currentUser.getId());
		message.setContent(content);
		message.setCreatedAt(Instant.now());

		Message saved = messageRepository.save(message);

		conversation.setUpdatedAt(Instant.now());
		conversationRepository.save(conversation);

		if ("DIRECT".equals(conversation.getType())) {
			Long recipientId = conversationParticipantRepository
					.findOtherParticipants(conversation.getId(), currentUser.getId()).stream().findFirst()
					.map(participant -> participant.getId().getUserId()).orElse(null);
			if (recipientId != null) {
				applicationEventPublisher.publishEvent(new MessageCreatedEvent(saved.getId(), saved.getConversationId(), recipientId,
						currentUser.getId(), currentUser.getDisplayName()));
			}
		}

		return new MessageResponse(saved.getId(), saved.getConversationId(), saved.getSenderId(), saved.getContent(),
				saved.getCreatedAt());
	}

	private String normalizeContent(String content) {
		if (content == null) {
			return null;
		}
		return content.trim();
	}

	private boolean areFriends(Long firstUserId, Long secondUserId) {
		return friendRequestRepository.areFriends(firstUserId, secondUserId);
	}

	private String buildConversationKey(Long firstUserId, Long secondUserId) {
		Long smaller = Math.min(firstUserId, secondUserId);
		Long larger = Math.max(firstUserId, secondUserId);
		return smaller + ":" + larger;
	}

	private void addParticipantIfMissing(Long conversationId, Long userId) {
		if (!conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, userId)) {
			ConversationParticipant participant = new ConversationParticipant(conversationId, userId);
			participant.setCreatedAt(Instant.now());
			conversationParticipantRepository.save(participant);
		}
	}

	private UserSummaryResponse toUserSummary(User user) {
		return new UserSummaryResponse(user.getId(), user.getUsername(), user.getDisplayName());
	}
}
