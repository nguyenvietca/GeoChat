package com.geochat.chat.service;

import com.geochat.chat.repository.UnreadStateRow;
import com.geochat.chat.repository.MessageReactionRepository;
import com.geochat.chat.entity.MessageReaction;
import com.geochat.chat.event.MessageReactionsChangedEvent;
import com.geochat.chat.dto.ChatDtos.*;
import com.geochat.chat.dto.ChatDtos.ReadStateResponse;
import com.geochat.chat.event.ConversationReadEvent;
import com.geochat.chat.event.ConversationActivityEvent;

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
import com.geochat.chat.dto.ChatDtos.TypingEventResponse;
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
	private final MessageReactionRepository reactionRepository;
    private final com.geochat.chat.repository.MessageAttachmentRepository attachmentRepository;
    private final ImageStorage imageStorage;
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
				WebSocketSessionRegistry webSocketSessionRegistry, MessageReactionRepository reactionRepository, com.geochat.chat.repository.MessageAttachmentRepository attachmentRepository, ImageStorage imageStorage) {
		this.conversationRepository = conversationRepository;
		this.conversationParticipantRepository = conversationParticipantRepository;
		this.messageRepository = messageRepository;
		this.reactionRepository = reactionRepository;
        this.attachmentRepository = attachmentRepository; this.imageStorage = imageStorage;
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

		return new OpenDirectChatResponse(conversation.getId(), conversation.getType(), toUserSummary(otherUser), conversation.getUpdatedAt());
	}

	@Transactional
	public OpenDirectChatResponse openContextualConversation(String username, OpenContextualChatRequest request) {
        return openNonFriendConversation(username, request, false);
    }

    @Transactional
    public OpenDirectChatResponse openDiscoveryConversation(String username, OpenDirectChatRequest request) {
        return openNonFriendConversation(username, new OpenContextualChatRequest(request.userId(), null), true);
    }

    private OpenDirectChatResponse openNonFriendConversation(String username, OpenContextualChatRequest request,
                                                             boolean fromSearch) {
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
            boolean shareGroup = fromSearch || conversationParticipantRepository.shareGroup(currentUser.getId(), otherUser.getId());
            boolean nearby = !fromSearch && locationService.isWithinRadius(username, otherUser.getId(), request.radiusMeters());
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
		return new OpenDirectChatResponse(conversation.getId(), conversation.getType(), toUserSummary(otherUser), conversation.getUpdatedAt());
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

        List<Long> visibleIds = participants.stream().map(ConversationParticipant::getConversationId).toList();
        Map<Long, UnreadStateRow> unreadStates = visibleIds.isEmpty() ? Map.of()
                : conversationParticipantRepository.findUnreadStates(currentUser.getId(), visibleIds).stream()
                    .collect(Collectors.toMap(UnreadStateRow::getConversationId,
                            java.util.function.Function.identity()));
        Map<Long, Conversation> visibleConversations = conversationRepository.findSummariesByIds(visibleIds).stream()
                .collect(Collectors.toMap(Conversation::getId, java.util.function.Function.identity()));
        Map<Long, List<ConversationParticipant>> members = visibleIds.isEmpty() ? Map.of()
                : conversationParticipantRepository.findByIdConversationIdIn(visibleIds).stream()
                    .collect(Collectors.groupingBy(ConversationParticipant::getConversationId));
        Map<Long, Message> latestMessages = visibleIds.isEmpty() ? Map.of()
                : messageRepository.findLatestMessagesByConversationIds(visibleIds).stream()
                    .collect(Collectors.toMap(Message::getConversationId, java.util.function.Function.identity()));
        java.util.Set<Long> userIds = members.values().stream().flatMap(List::stream)
                .map(ConversationParticipant::getUserId).collect(Collectors.toSet());
        latestMessages.values().forEach(message -> userIds.add(message.getSenderId()));
        Map<Long, User> users = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, java.util.function.Function.identity()));
		for (ConversationParticipant participant : participants) {
			Conversation conversation = visibleConversations.get(participant.getConversationId());
			if (conversation == null) {
				continue;
			}
			List<ConversationParticipant> others = members.getOrDefault(conversation.getId(), List.of()).stream()
                    .filter(member -> !member.getUserId().equals(currentUser.getId()))
                    .sorted(Comparator.comparing(ConversationParticipant::getUserId)).toList();
			boolean ownerOnlyGroup = others.isEmpty() && "GROUP".equals(conversation.getType());
			if (others.isEmpty() && !ownerOnlyGroup) {
				continue;
			}

			User otherUser = ownerOnlyGroup ? currentUser
					: users.get(others.get(0).getUserId());
			if (otherUser == null) {
				continue;
			}
            Message latest = latestMessages.get(conversation.getId());
            User sender = latest == null ? null : users.get(latest.getSenderId());
            ConversationSummaryResponse summary = new ConversationSummaryResponse(conversation.getId(),
                    conversation.getType(), toUserSummary(otherUser), conversation.getUpdatedAt(),
                    latest == null ? null : latest.getContent(), latest == null ? null : latest.getId(),
                    latest == null ? null : latest.getCreatedAt(), sender == null ? null : sender.getDisplayName(),
                    conversation.getGroupName(), unreadStates.get(conversation.getId()).getUnreadCount(),
                    unreadStates.get(conversation.getId()).getReadStateVersion(), unreadStates.get(conversation.getId()).getReadStateSince());
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

        var latestIds = items.stream().map(ConversationSummaryResponse::lastMessageId).filter(java.util.Objects::nonNull).toList();
        java.util.Set<Long> latestImages = latestIds.isEmpty() ? java.util.Set.of() : attachmentRepository.findByMessageIdIn(latestIds).stream().map(com.geochat.chat.entity.MessageAttachment::getMessageId).collect(Collectors.toSet());
        items.replaceAll(item -> item.lastMessageId() == null || !latestImages.contains(item.lastMessageId()) ? item : new ConversationSummaryResponse(item.conversationId(),item.type(),item.participant(),item.updatedAt(),"Photo"+(item.lastMessage().isBlank()?"":": "+item.lastMessage()),item.lastMessageId(),item.lastMessageAt(),item.lastMessageSender(),item.groupName(),item.unreadCount(),item.readStateVersion(),item.readStateSince()));
        items.sort(Comparator.comparing(
                (ConversationSummaryResponse item) -> item.lastMessageAt() == null ? item.updatedAt() : item.lastMessageAt(),
                Comparator.reverseOrder()).thenComparing(ConversationSummaryResponse::conversationId));
        return new ConversationListResponse(items);
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
                && !hasFriendParticipant(currentUser.getId(), conversationId)
				? Math.max(0, CONTEXTUAL_MESSAGE_LIMIT - (int) messageRepository.countByConversationIdAndSenderId(conversationId, currentUser.getId()))
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
		return createPersistedMessage(username, conversationId, content, request == null ? null : request.replyToMessageId());
	}

	@Transactional
	public MessageResponse sendMessageFromWebSocket(String username, Long conversationId, String rawContent) {
		String content = normalizeContent(rawContent);
		return createPersistedMessage(username, conversationId, content, null);
	}

	@Transactional(readOnly = true)
	public TypingEventResponse createTypingEvent(String username, Long conversationId, String state) {
		if (!"START".equals(state) && !"STOP".equals(state)) {
			throw new IllegalArgumentException("typing state must be START or STOP");
		}
		User sender = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));
		conversationRepository.findById(conversationId)
				.orElseThrow(() -> new EntityNotFoundException("Conversation not found"));
		if (!conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, sender.getId())) {
			throw new AccessDeniedException("You are not a participant in this conversation");
		}
		return new TypingEventResponse(conversationId, sender.getId(), sender.getDisplayName(), "TYPING", state, 0);
	}

	@Transactional
	public MessageListResponse listMessages(String username, Long conversationId, Integer limit) {
		return listMessages(username, conversationId, limit, 0);
	}

	@Transactional
	public MessageListResponse listMessages(String username, Long conversationId, Integer limit, Integer page) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		Conversation conversation = conversationRepository.findByIdForUpdate(conversationId)
				.orElseThrow(() -> new EntityNotFoundException("Conversation not found"));

		if (!conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
			throw new AccessDeniedException("You are not a participant in this conversation");
		}

		int safeLimit = limit == null || limit <= 0 ? 20 : Math.min(limit, 100);
        int safePage = page == null || page < 0 ? 0 : page;
		Pageable pageable = PageRequest.of(safePage, safeLimit);
		List<Message> messages = messageRepository.findByConversationIdOrderByCreatedAtDescIdDesc(
				conversation.getId(), pageable);

		List<MessageResponse> items = new ArrayList<>(presentMessages(messages, currentUser.getId()));
		Collections.reverse(items);

		return new MessageListResponse(items, messageRepository.countByConversationId(conversation.getId()), safePage,
				safeLimit);
	}

	public boolean isParticipant(String username, Long conversationId) {
		if (conversationId == null || username == null || username.isBlank()) {
			return false;
		}

        return conversationParticipantRepository.existsForUsername(conversationId, username);
	}

	private MessageResponse createPersistedMessage(String username, Long conversationId, String content, Long replyToMessageId) {
        return createPersistedMessage(username, conversationId, content, replyToMessageId, null, null);
    }
    private MessageResponse createPersistedMessage(String username, Long conversationId, String content, Long replyToMessageId, ImageStorage.Stored image, String requestId) {
		User currentUser = userRepository.findByUsernameIgnoreCase(username)
				.orElseThrow(() -> new EntityNotFoundException("User not found"));

		Conversation conversation = conversationRepository.findByIdForUpdate(conversationId)
				.orElseThrow(() -> new EntityNotFoundException("Conversation not found"));

		if (!conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
			throw new AccessDeniedException("You are not a participant in this conversation");
		}

        // Serialize quota checks and inserts in the same transaction for REST and STOMP sends.
        if (conversation.isContextualLimited()) {
            if (hasFriendParticipant(currentUser.getId(), conversationId)) {
                conversation.setContextualLimited(false);
            }
        }

		if (image == null && (content == null || content.isBlank())) {
			throw new IllegalArgumentException("message content is required");
		}

		if (content.length() > 5000) {
			throw new IllegalArgumentException("message content must be at most 5000 characters");
		}
		if (conversation.isContextualLimited()
				&& messageRepository.countByConversationIdAndSenderId(conversationId, currentUser.getId()) >= CONTEXTUAL_MESSAGE_LIMIT) {
			throw new IllegalArgumentException("You can send at most 5 messages before becoming friends. Add each other as friends to continue");
		}

		if (replyToMessageId != null) {
            messageRepository.findById(replyToMessageId)
                    .filter(target -> target.getConversationId().equals(conversationId))
                    .orElseThrow(() -> new IllegalArgumentException("Reply must reference an existing message in this conversation"));
        }
        Message message = new Message();
        message.setReplyToMessageId(replyToMessageId);
		message.setConversationId(conversation.getId());
		message.setSenderId(currentUser.getId());
		message.setContent(content);
		message.setCreatedAt(Instant.now());

		Message saved = messageRepository.save(message);
        if (image != null) attachmentRepository.saveAndFlush(new com.geochat.chat.entity.MessageAttachment(saved.getId(),conversationId,currentUser.getId(),requestId,image));

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

        MessageResponse response = presentMessages(List.of(saved), currentUser.getId()).getFirst();
        // Version every activity so delayed unread snapshots can be ignored by clients.
        conversationParticipantRepository.advanceReadStateVersions(conversationId);
        applicationEventPublisher.publishEvent(new ConversationActivityEvent(response,
                currentUser.getDisplayName()));
        return response;
	}

    @Transactional
    public MessageResponse sendImage(String username, Long conversationId, org.springframework.web.multipart.MultipartFile file, String caption, Long replyId, String requestId) {
        // Membership lock serializes duplicate submissions and deletion with image binding.
        User user = requireActionUser(username, conversationId);
        try { if (!java.util.UUID.fromString(requestId).toString().equals(requestId)) throw new IllegalArgumentException(); }
        catch (RuntimeException ex) { throw new IllegalArgumentException("A valid image request ID is required"); }
        var previous = attachmentRepository.findByRequestId(requestId);
        if (previous.isPresent()) {
            var image = previous.get();
            if (!image.getUploaderId().equals(user.getId()) || !image.getConversationId().equals(conversationId)) throw new AccessDeniedException("Image request unavailable");
            var saved = messageRepository.findById(image.getMessageId()).orElseThrow();
            if (!saved.getContent().equals(caption == null ? "" : caption.trim()) || !java.util.Objects.equals(saved.getReplyToMessageId(), replyId)) throw new IllegalArgumentException("This image was already sent with different text. Check recent messages before choosing it again");
            return presentMessages(List.of(saved), user.getId()).getFirst();
        }
        String text = caption == null ? "" : caption.trim();
        if (text.length() > 5000) throw new IllegalArgumentException("Caption must be at most 5000 characters");
        ImageStorage.Stored stored = imageStorage.store(file);
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) try { imageStorage.delete(stored.key()); } catch (RuntimeException ignored) { }
            }
        });
        return createPersistedMessage(username, conversationId, text, replyId, stored, requestId);
    }

    @Transactional
    public com.geochat.chat.entity.MessageAttachment authorizedImage(String username, Long id) {
        var image = attachmentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Image unavailable"));
        if (!isParticipant(username, image.getConversationId())) throw new EntityNotFoundException("Image unavailable");
        return image;
    }

    // URL-safe keys avoid servlet/path encoding differences for emoji characters.
    public static final List<String> REACTION_KEYS = List.of("thumbs-up", "heart", "laugh", "surprised", "sad", "angry");
    public static final List<String> REACTION_EMOJIS = List.of("👍", "❤️", "😂", "😮", "😢", "😡");

    @Transactional
    public MessageReactionState setReaction(String username, Long conversationId, Long messageId, String key, boolean add) {
        User user = requireActionUser(username, conversationId);
        Message message = messageRepository.findById(messageId)
                .filter(item -> item.getConversationId().equals(conversationId))
                .orElseThrow(() -> new IllegalArgumentException("Reaction target must be a message in this conversation"));
        int index = REACTION_KEYS.indexOf(key);
        if (index < 0) throw new IllegalArgumentException("Unsupported reaction emoji");
        String emoji = REACTION_EMOJIS.get(index);
        boolean exists = reactionRepository.existsByMessageIdAndUserIdAndEmoji(messageId, user.getId(), emoji);
        if (add != exists) {
            if (add) reactionRepository.save(new MessageReaction(messageId, user.getId(), emoji));
            else reactionRepository.deleteByMessageIdAndUserIdAndEmoji(messageId, user.getId(), emoji);
            message.setReactionVersion(message.getReactionVersion() + 1);
            messageRepository.saveAndFlush(message);
            reactionRepository.flush();
            applicationEventPublisher.publishEvent(new MessageReactionsChangedEvent(conversationId, messageId, message.getReactionVersion()));
        }
        return reactionStates(List.of(message), user.getId()).getFirst();
    }

    @Transactional
    public ReactionStatesResponse getReactionStates(String username, Long conversationId, List<Long> messageIds) {
        if (messageIds == null || messageIds.isEmpty() || messageIds.size() > 100
                || messageIds.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new IllegalArgumentException("Provide between 1 and 100 positive message IDs");
        }
        User user = requireActionUser(username, conversationId);
        List<Message> messages = messageRepository.findAllById(messageIds.stream().distinct().toList());
        if (messages.size() != messageIds.stream().distinct().count()
                || messages.stream().anyMatch(message -> !message.getConversationId().equals(conversationId))) {
            throw new IllegalArgumentException("Reaction targets must be messages in this conversation");
        }
        return new ReactionStatesResponse(reactionStates(messages, user.getId()));
    }

    // Group membership changes and hard deletion use this same conversation lock.
    private User requireActionUser(String username, Long conversationId) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        conversationRepository.findByIdForUpdate(conversationId)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found"));
        if (!conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, user.getId())) {
            throw new AccessDeniedException("You are not a participant in this conversation");
        }
        return user;
    }

    private List<MessageReactionState> reactionStates(List<Message> messages, Long userId) {
        if (messages.isEmpty()) return List.of();
        var rows = reactionRepository.summarize(messages.stream().map(Message::getId).toList(), userId);
        Map<Long, List<ReactionSummary>> grouped = new java.util.HashMap<>();
        for (var row : rows) {
            grouped.computeIfAbsent(row.getMessageId(), id -> new ArrayList<>())
                    .add(new ReactionSummary(row.getEmoji(), row.getReactionCount(), row.getMyCount() > 0));
        }
        grouped.values().forEach(items -> items.sort(Comparator.comparingInt(item -> REACTION_EMOJIS.indexOf(item.emoji()))));
        return messages.stream().map(message -> new MessageReactionState(message.getId(), message.getReactionVersion(),
                grouped.getOrDefault(message.getId(), List.of()))).toList();
    }

    private List<MessageResponse> presentMessages(List<Message> messages, Long userId) {
        if (messages.isEmpty()) return List.of();
        var replyIds = messages.stream().map(Message::getReplyToMessageId).filter(java.util.Objects::nonNull).distinct().toList();
        Map<Long, Message> originals = messageRepository.findAllById(replyIds).stream()
                .collect(Collectors.toMap(Message::getId, java.util.function.Function.identity()));
        Map<Long, User> senders = userRepository.findAllById(originals.values().stream().map(Message::getSenderId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, java.util.function.Function.identity()));
        Map<Long, MessageReactionState> reactions = reactionStates(messages, userId).stream()
                .collect(Collectors.toMap(MessageReactionState::messageId, java.util.function.Function.identity()));
        Map<Long, com.geochat.chat.dto.ChatDtos.ImageAttachment> images = attachmentRepository.findByMessageIdIn(messages.stream().map(Message::getId).toList()).stream().collect(Collectors.toMap(com.geochat.chat.entity.MessageAttachment::getMessageId, item -> new com.geochat.chat.dto.ChatDtos.ImageAttachment(item.getId(),item.getContentType(),item.getSizeBytes(),item.getWidth(),item.getHeight())));
        return messages.stream().map(message -> {
            Message original = originals.get(message.getReplyToMessageId());
            ReplyPreview preview = null;
            if (original != null && original.getConversationId().equals(message.getConversationId())) {
                User sender = senders.get(original.getSenderId());
                String content = original.getContent().isBlank() ? "Photo" : original.getContent();
                int end = content.offsetByCodePoints(0, Math.min(160, content.codePointCount(0, content.length())));
                preview = new ReplyPreview(original.getId(), sender == null ? "Member" : sender.getDisplayName(),
                        content.substring(0, end));
            }
            var state = reactions.get(message.getId());
            return new MessageResponse(message.getId(), message.getConversationId(), message.getSenderId(),
                    message.getContent(), message.getCreatedAt(), message.getReplyToMessageId(), preview,
                    state.reactions(), state.version(), images.get(message.getId()));
        }).toList();
    }

    @Transactional
    public ReadStateResponse markConversationRead(String username, Long conversationId, Long messageId) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        conversationRepository.findByIdForUpdate(conversationId)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found"));
        ConversationParticipant participant = conversationParticipantRepository
                .findByConversationIdAndUserId(conversationId, user.getId())
                .orElseThrow(() -> new AccessDeniedException("You are not a participant in this conversation"));
        Message message = messageRepository.findById(messageId)
                .filter(item -> item.getConversationId().equals(conversationId))
                .orElseThrow(() -> new IllegalArgumentException("Read cursor must reference a message in this conversation"));
        Instant previousTime = participant.getLastReadMessageAt();
        boolean advanced = previousTime == null || message.getCreatedAt().isAfter(previousTime)
                || (message.getCreatedAt().equals(previousTime) && message.getId() > participant.getLastReadMessageId());
        if (advanced) {
            participant.setLastReadMessageId(message.getId());
            participant.setLastReadMessageAt(message.getCreatedAt());
            participant.setReadStateVersion(participant.getReadStateVersion() + 1);
            conversationParticipantRepository.saveAndFlush(participant);
        }
        var state = conversationParticipantRepository.findUnreadStates(user.getId(), List.of(conversationId)).getFirst();
        var response = new ReadStateResponse(conversationId,
                state.getUnreadCount(), state.getReadStateVersion(), state.getReadStateSince());
        if (advanced) applicationEventPublisher.publishEvent(new ConversationReadEvent(username, response));
        return response;
    }

	private String normalizeContent(String content) {
		if (content == null) {
			return null;
		}
		return content.trim();
	}

    private boolean hasFriendParticipant(Long userId, Long conversationId) {
        return conversationParticipantRepository.findOtherParticipants(conversationId, userId).stream()
                .anyMatch(participant -> areFriends(userId, participant.getUserId()));
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
