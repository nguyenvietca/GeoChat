package com.geochat.chat.service;

import com.geochat.chat.dto.AddGroupMembersRequest;
import com.geochat.chat.dto.ChatDtos.GroupInfoResponse;
import com.geochat.chat.dto.ChatDtos.GroupMemberResponse;
import com.geochat.chat.dto.ChatDtos.GroupMembersResponse;
import com.geochat.chat.dto.ChatDtos.UserSummaryResponse;
import com.geochat.chat.dto.CreateGroupRequest;
import com.geochat.chat.dto.RenameGroupRequest;
import com.geochat.chat.event.GroupManagementEvent;
import com.geochat.chat.entity.Conversation;
import com.geochat.chat.entity.ConversationParticipant;
import com.geochat.chat.repository.ConversationParticipantRepository;
import com.geochat.chat.repository.ConversationRepository;
import com.geochat.chat.repository.MessageRepository;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class GroupService {

    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final int maxGroupMembers;

    private final MessageRepository messageRepository;

    public GroupService(ConversationRepository conversationRepository,
                        MessageRepository messageRepository,
                        ConversationParticipantRepository participantRepository,
                        UserRepository userRepository,
                        FriendRequestRepository friendRequestRepository,
                        ApplicationEventPublisher applicationEventPublisher,
                        @Value("${app.chat.max-group-members:100}") int maxGroupMembers) {
        this.conversationRepository = conversationRepository;
        this.participantRepository = participantRepository;
        this.userRepository = userRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.applicationEventPublisher = applicationEventPublisher;
        this.maxGroupMembers = maxGroupMembers;
        this.messageRepository = messageRepository;
    }

    @Transactional
    public GroupInfoResponse createGroup(String username, CreateGroupRequest request) {
        User owner = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        String name = request.name().trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("group name is required");
        }

        Set<Long> memberIds = new LinkedHashSet<>();
        if (request.memberIds() != null) {
            for (Long memberId : request.memberIds()) {
                if (memberId == null || memberId <= 0) {
                    throw new IllegalArgumentException("Member IDs must be valid user IDs");
                }
                if (!memberId.equals(owner.getId())) {
                    memberIds.add(memberId);
                }
            }
        }

        if (memberIds.size() + 1 > maxGroupMembers) {
            throw new IllegalArgumentException("Group cannot exceed " + maxGroupMembers + " members");
        }

        List<User> members = new ArrayList<>(userRepository.findAllById(memberIds));
        if (members.size() != memberIds.size()) {
            throw new IllegalArgumentException("One or more member IDs are invalid");
        }
        for (User member : members) {
            if (!friendRequestRepository.areFriends(owner.getId(), member.getId())) {
                throw new IllegalArgumentException("All group members must be friends with the owner");
            }
        }

        Instant now = Instant.now();
        Conversation conversation = new Conversation();
        conversation.setType("GROUP");
        conversation.setConversationKey("GROUP:" + UUID.randomUUID());
        conversation.setGroupName(name);
        conversation.setOwner(owner);
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        Conversation savedConversation = conversationRepository.save(conversation);

        List<ConversationParticipant> participants = new ArrayList<>();
        ConversationParticipant ownerParticipant = new ConversationParticipant(savedConversation.getId(), owner.getId());
        ownerParticipant.setRole("OWNER");
        ownerParticipant.setCreatedAt(now);
        participants.add(ownerParticipant);
        for (User member : members) {
            ConversationParticipant participant = new ConversationParticipant(savedConversation.getId(), member.getId());
            participant.setRole("MEMBER");
            participant.setCreatedAt(now);
            participants.add(participant);
        }
        participantRepository.saveAll(participants);
        return toGroupInfo(savedConversation, owner, participants.size());
    }

    @Transactional(readOnly = true)
    public GroupInfoResponse getGroup(String username, Long groupId) {
        Conversation conversation = requireGroupMember(username, groupId);
        return toGroupInfo(conversation, conversation.getOwner(),
                (int) participantRepository.countByConversationId(groupId));
    }

    @Transactional
    public GroupInfoResponse renameGroup(String username, Long groupId, RenameGroupRequest request) {
        Conversation conversation = requireGroupMember(username, groupId, true);
        User owner = requireOwner(conversation, username);
        String name = request.name().trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("group name is required");
        }
        conversation.setGroupName(name);
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);
        GroupInfoResponse response = toGroupInfo(conversation, owner, (int) participantRepository.countByConversationId(groupId));
        applicationEventPublisher.publishEvent(new GroupManagementEvent("GROUP_RENAMED", response, null));
        return response;
    }

    @Transactional(readOnly = true)
    public GroupMembersResponse getMembers(String username, Long groupId) {
        requireGroupMember(username, groupId);
        var participants = participantRepository.findByConversationIdOrderByIdAsc(groupId);
        Map<Long, User> users = userRepository.findAllById(participants.stream()
                .map(ConversationParticipant::getUserId).toList()).stream()
            .collect(Collectors.toMap(User::getId, Function.identity()));
        List<GroupMemberResponse> members = participants.stream()
            .map(participant -> users.get(participant.getUserId()) == null ? null
                : new GroupMemberResponse(toUserSummary(users.get(participant.getUserId())), participant.getRole(),
                participant.getCreatedAt()))
            .filter(member -> member != null)
                .toList();
        return new GroupMembersResponse(members);
    }

    @Transactional
    public void leaveGroup(String username, Long groupId) {
        Conversation conversation = requireGroupMember(username, groupId, true);
        Long userId = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found")).getId();
        ConversationParticipant participant = participantRepository.findByConversationIdAndUserId(groupId, userId)
                .orElseThrow(() -> new AccessDeniedException("You are not a member of this group"));
        if ("OWNER".equals(participant.getRole())) {
            throw new IllegalArgumentException("The group owner cannot leave without transferring ownership");
        }
        User departingUser = userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found"));
        GroupMemberResponse departedMember = new GroupMemberResponse(toUserSummary(departingUser),
            participant.getRole(), participant.getCreatedAt());
        participantRepository.delete(participant);
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);
        User owner = conversation.getOwner();
        GroupInfoResponse response = toGroupInfo(conversation, owner, (int) participantRepository.countByConversationId(groupId));
        applicationEventPublisher.publishEvent(new GroupManagementEvent("MEMBER_LEFT", response, departedMember));
    }

    @Transactional
    public GroupInfoResponse addMembers(String username, Long groupId, AddGroupMembersRequest request) {
        Conversation conversation = requireGroupMember(username, groupId, true);
        User owner = requireOwner(conversation, username);

        Set<Long> newIds = new LinkedHashSet<>();
        for (Long memberId : request.memberIds()) {
            if (memberId == null || memberId <= 0) {
                throw new IllegalArgumentException("Member IDs must be valid user IDs");
            }
            if (!memberId.equals(owner.getId())) {
                newIds.add(memberId);
            }
        }
        if (newIds.isEmpty()) {
            throw new IllegalArgumentException("Select at least one friend to add");
        }
        for (Long memberId : newIds) {
            if (participantRepository.existsByConversationIdAndUserId(groupId, memberId)) {
                throw new IllegalArgumentException("One or more users are already in this group");
            }
        }
        long currentCount = participantRepository.countByConversationId(groupId);
        if (currentCount + newIds.size() > maxGroupMembers) {
            throw new IllegalArgumentException("Group cannot exceed " + maxGroupMembers + " members");
        }

        List<User> users = new ArrayList<>(userRepository.findAllById(newIds));
        if (users.size() != newIds.size()) {
            throw new IllegalArgumentException("One or more member IDs are invalid");
        }
        Instant now = Instant.now();
        List<ConversationParticipant> participants = new ArrayList<>();
        List<GroupMemberResponse> addedMembers = new ArrayList<>();
        for (User user : users) {
            if (!friendRequestRepository.areFriends(owner.getId(), user.getId())) {
                throw new IllegalArgumentException("All group members must be friends with the owner");
            }
            ConversationParticipant participant = new ConversationParticipant(groupId, user.getId());
            participant.setRole("MEMBER");
            participant.setCreatedAt(now);
            participants.add(participant);
            addedMembers.add(new GroupMemberResponse(toUserSummary(user), "MEMBER", now));
        }
        participantRepository.saveAll(participants);
        conversation.setUpdatedAt(now);
        conversationRepository.save(conversation);
        GroupInfoResponse response = toGroupInfo(conversation, owner,
                (int) participantRepository.countByConversationId(groupId));
        for (GroupMemberResponse member : addedMembers) {
            applicationEventPublisher.publishEvent(new GroupManagementEvent("MEMBER_ADDED", response, member));
        }
        return response;
    }

    @Transactional
    public GroupInfoResponse removeMember(String username, Long groupId, Long memberId) {
        Conversation conversation = requireGroupMember(username, groupId, true);
        User owner = requireOwner(conversation, username);
        if (owner.getId().equals(memberId)) {
            throw new IllegalArgumentException("The group owner cannot be removed");
        }
        ConversationParticipant participant = participantRepository.findByConversationIdAndUserId(groupId, memberId)
                .orElseThrow(() -> new EntityNotFoundException("Member not found in this group"));
        User removedUser = userRepository.findById(memberId)
            .orElseThrow(() -> new EntityNotFoundException("Member not found in this group"));
        GroupMemberResponse removedMember = new GroupMemberResponse(toUserSummary(removedUser),
            participant.getRole(), participant.getCreatedAt());
        participantRepository.delete(participant);
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);
        GroupInfoResponse response = toGroupInfo(conversation, owner, (int) participantRepository.countByConversationId(groupId));
        applicationEventPublisher.publishEvent(new GroupManagementEvent("MEMBER_REMOVED", response, removedMember));
        return response;
    }

    @Transactional
    public void deleteGroup(String username, Long groupId) {
        Conversation conversation = requireGroupMember(username, groupId, true);
        User owner = requireOwner(conversation, username);
        var participants = participantRepository.findByConversationIdOrderByIdAsc(groupId);
        Map<Long, User> users = userRepository.findAllById(participants.stream()
                        .map(ConversationParticipant::getUserId).toList()).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        GroupInfoResponse snapshot = toGroupInfo(conversation, owner, 0);
        List<GroupMemberResponse> formerMembers = participants.stream()
                .filter(participant -> users.containsKey(participant.getUserId()))
                .map(participant -> new GroupMemberResponse(toUserSummary(users.get(participant.getUserId())),
                        participant.getRole(), participant.getCreatedAt()))
                .toList();

        messageRepository.deleteAllByConversationId(groupId);
        participantRepository.deleteAll(participants);
        conversationRepository.delete(conversation);
        for (GroupMemberResponse member : formerMembers) {
            applicationEventPublisher.publishEvent(new GroupManagementEvent("GROUP_DELETED", snapshot, member));
        }
    }

    private User requireOwner(Conversation conversation, String username) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        if (conversation.getOwner() == null || !conversation.getOwner().getId().equals(user.getId())) {
            throw new AccessDeniedException("Only the group owner can manage members");
        }
        return user;
    }

    private Conversation requireGroupMember(String username, Long groupId) {
        return requireGroupMember(username, groupId, false);
    }

    private Conversation requireGroupMember(String username, Long groupId, boolean lock) {
        Conversation conversation = (lock ? conversationRepository.findByIdForUpdate(groupId)
                : conversationRepository.findById(groupId))
                .filter(item -> "GROUP".equals(item.getType()))
                .orElseThrow(() -> new EntityNotFoundException("Group not found"));
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        if (!participantRepository.existsByConversationIdAndUserId(groupId, user.getId())) {
            throw new AccessDeniedException("You are not a member of this group");
        }
        return conversation;
    }

    private GroupInfoResponse toGroupInfo(Conversation conversation, User owner, int memberCount) {
        return new GroupInfoResponse(conversation.getId(), conversation.getGroupName(), toUserSummary(owner),
                memberCount, conversation.getCreatedAt(), conversation.getUpdatedAt());
    }

    private UserSummaryResponse toUserSummary(User user) {
        return new UserSummaryResponse(user.getId(), user.getUsername(), user.getDisplayName());
    }
}