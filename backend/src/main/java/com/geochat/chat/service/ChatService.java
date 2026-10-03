package com.geochat.chat.service;

import com.geochat.chat.dto.ChatDtos.ConversationDetailResponse;
import com.geochat.chat.dto.ChatDtos.ConversationListResponse;
import com.geochat.chat.dto.ChatDtos.ConversationSummaryResponse;
import com.geochat.chat.dto.ChatDtos.MessageListResponse;
import com.geochat.chat.dto.ChatDtos.MessageResponse;
import com.geochat.chat.dto.ChatDtos.OpenDirectChatResponse;
import com.geochat.chat.dto.ChatDtos.UserSummaryResponse;
import com.geochat.chat.dto.OpenDirectChatRequest;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.entity.Conversation;
import com.geochat.chat.entity.ConversationParticipant;
import com.geochat.chat.entity.Message;
import com.geochat.chat.repository.ConversationParticipantRepository;
import com.geochat.chat.repository.ConversationRepository;
import com.geochat.chat.repository.MessageRepository;
import com.geochat.common.response.ApiResponse;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository conversationParticipantRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;

    public ChatService(
            ConversationRepository conversationRepository,
            ConversationParticipantRepository conversationParticipantRepository,
            MessageRepository messageRepository,
            UserRepository userRepository,
            FriendRequestRepository friendRequestRepository) {
        this.conversationRepository = conversationRepository;
        this.conversationParticipantRepository = conversationParticipantRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.friendRequestRepository = friendRequestRepository;
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

    @Transactional(readOnly = true)
    public ConversationListResponse listConversations(String username) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        List<ConversationSummaryResponse> items = new ArrayList<>();
        List<ConversationParticipant> participants = conversationParticipantRepository.findByUserIdOrderByConversationIdDesc(currentUser.getId());

        for (ConversationParticipant participant : participants) {
            Conversation conversation = conversationRepository.findById(participant.getConversationId())
                    .orElse(null);
            if (conversation == null) {
                continue;
            }
            List<ConversationParticipant> others = conversationParticipantRepository.findOtherParticipants(conversation.getId(), currentUser.getId());
            if (others.isEmpty()) {
                continue;
            }

            User otherUser = userRepository.findById(others.get(0).getUserId()).orElse(null);
            if (otherUser == null) {
                continue;
            }
            items.add(new ConversationSummaryResponse(
                    conversation.getId(),
                    conversation.getType(),
                    toUserSummary(otherUser),
                    conversation.getUpdatedAt()));
        }

        items.sort(Comparator.comparing(ConversationSummaryResponse::updatedAt, Comparator.reverseOrder()));
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

        List<UserSummaryResponse> participants = conversationParticipantRepository.findByConversationIdOrderByIdAsc(conversationId).stream()
                .map(participant -> userRepository.findById(participant.getUserId()).orElse(null))
                .filter(user -> user != null)
                .map(this::toUserSummary)
                .toList();

        return new ConversationDetailResponse(
                conversation.getId(),
                conversation.getType(),
                participants,
                conversation.getCreatedAt(),
                conversation.getUpdatedAt());
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
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found"));

        if (!conversationParticipantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
            throw new AccessDeniedException("You are not a participant in this conversation");
        }

        int safeLimit = limit == null || limit <= 0 ? 20 : Math.min(limit, 100);
        Pageable pageable = PageRequest.of(0, safeLimit);
        List<Message> messages = messageRepository.findByConversationIdOrderByCreatedAtAscIdAsc(conversation.getId(), pageable);

        List<MessageResponse> items = messages.stream()
                .map(message -> new MessageResponse(
                        message.getId(),
                        message.getConversationId(),
                        message.getSenderId(),
                        message.getContent(),
                        message.getCreatedAt()))
                .toList();

        return new MessageListResponse(items, messageRepository.countByConversationId(conversation.getId()), 0, safeLimit);
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

        Message message = new Message();
        message.setConversationId(conversation.getId());
        message.setSenderId(currentUser.getId());
        message.setContent(content);
        message.setCreatedAt(Instant.now());

        Message saved = messageRepository.save(message);

        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);

        return new MessageResponse(
                saved.getId(),
                saved.getConversationId(),
                saved.getSenderId(),
                saved.getContent(),
                saved.getCreatedAt());
    }

    private String normalizeContent(String content) {
        if (content == null) {
            return null;
        }
        return content.trim();
    }

    private boolean areFriends(Long firstUserId, Long secondUserId) {
        return friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(firstUserId, secondUserId, FriendRequestStatus.ACCEPTED)
                || friendRequestRepository.existsByReceiverIdAndSenderIdAndStatus(firstUserId, secondUserId, FriendRequestStatus.ACCEPTED)
                || friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(secondUserId, firstUserId, FriendRequestStatus.ACCEPTED)
                || friendRequestRepository.existsByReceiverIdAndSenderIdAndStatus(secondUserId, firstUserId, FriendRequestStatus.ACCEPTED);
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
