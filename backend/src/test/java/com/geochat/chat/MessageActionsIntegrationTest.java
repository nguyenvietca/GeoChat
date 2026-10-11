package com.geochat.chat;

import com.geochat.auth.security.JwtService;
import com.geochat.chat.dto.*;
import com.geochat.chat.entity.Conversation;
import com.geochat.chat.entity.ConversationParticipant;
import com.geochat.chat.event.MessageReactionsChangedEvent;
import com.geochat.chat.repository.*;
import com.geochat.chat.service.ChatService;
import com.geochat.chat.service.GroupService;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.location.repository.UserLocationRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.event.EventListener;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.http.MediaType;
import java.util.List;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
@Import(MessageActionsIntegrationTest.Events.class)
class MessageActionsIntegrationTest {
    @Autowired ChatService chat;
    @Autowired GroupService groups;
    @Autowired MessageRepository messages;
    @Autowired MessageReactionRepository reactions;
    @Autowired ConversationRepository conversations;
    @Autowired ConversationParticipantRepository participants;
    @Autowired UserRepository users;
    @Autowired FriendRequestRepository friends;
    @Autowired UserLocationRepository locations;
    @Autowired JwtService jwt;
    @Autowired WebApplicationContext context;
    @Autowired Events events;
    MockMvc mvc;
    User alice, bob, outsider;
    Long conversationId;

    @TestConfiguration
    static class Events {
        final List<MessageReactionsChangedEvent> items = new CopyOnWriteArrayList<>();
        @EventListener public void record(MessageReactionsChangedEvent event) { items.add(event); }
    }

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
        reactions.deleteAll(); messages.deleteAll(); participants.deleteAll(); conversations.deleteAll();
        locations.deleteAll(); friends.deleteAll(); users.deleteAll(); events.items.clear();
        alice = user("actions-alice", "Alice"); bob = user("actions-bob", "Bob"); outsider = user("actions-outsider", "Outsider");
        conversationId = direct("actions-primary");
    }

    @Test void normalReplyNestedAndPaginatedPreviewRemainCompatible() throws Exception {
        var original = chat.sendMessage(alice.getUsername(), conversationId, new SendMessageRequest("original " + "x".repeat(200)));
        assertThat(original.replyToMessageId()).isNull();
        var reply = chat.sendMessage(bob.getUsername(), conversationId, new SendMessageRequest("reply", original.messageId()));
        assertThat(reply.replyPreview().senderDisplayName()).isEqualTo("Alice");
        assertThat(reply.replyPreview().excerpt()).hasSize(160);
        var nested = chat.sendMessage(alice.getUsername(), conversationId, new SendMessageRequest("nested", reply.messageId()));
        assertThat(nested.replyPreview().excerpt()).isEqualTo("reply");
        assertThat(chat.listMessages(alice.getUsername(), conversationId, 1, 0).items().getFirst().replyPreview())
                .isEqualTo(nested.replyPreview());
        mvc.perform(get("/api/v1/chats/{id}/messages", conversationId).header("Authorization", bearer(alice)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].messageId").value(original.messageId()))
                .andExpect(jsonPath("$.data.items[0].content").value(original.content()))
                .andExpect(jsonPath("$.data.items[0].senderId").value(alice.getId()))
                .andExpect(jsonPath("$.data.items[0].createdAt").isString());
        mvc.perform(post("/api/v1/chats/{id}/messages", conversationId).header("Authorization", bearer(alice))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"legacy\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.content").value("legacy"));
    }

    @Test void replyRejectsMissingCrossConversationAndUnauthorizedTargets() {
        var original = chat.sendMessage(alice.getUsername(), conversationId, new SendMessageRequest("original"));
        assertThatThrownBy(() -> chat.sendMessage(alice.getUsername(), conversationId, new SendMessageRequest("bad", Long.MAX_VALUE)))
                .isInstanceOf(IllegalArgumentException.class);
        Long other = direct("actions-other");
        assertThatThrownBy(() -> chat.sendMessage(alice.getUsername(), other, new SendMessageRequest("bad", original.messageId())))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> chat.sendMessage(outsider.getUsername(), conversationId, new SendMessageRequest("bad", original.messageId())))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test void reactionCountsPersonalizationOrderingAndIdempotence() {
        var message = chat.sendMessage(alice.getUsername(), conversationId, new SendMessageRequest("react"));
        var first = chat.setReaction(alice.getUsername(), conversationId, message.messageId(), "heart", true);
        assertThat(first.version()).isEqualTo(1);
        assertThat(chat.setReaction(alice.getUsername(), conversationId, message.messageId(), "heart", true)).isEqualTo(first);
        chat.setReaction(bob.getUsername(), conversationId, message.messageId(), "heart", true);
        var both = chat.setReaction(bob.getUsername(), conversationId, message.messageId(), "thumbs-up", true);
        assertThat(both.reactions()).extracting(ChatDtos.ReactionSummary::emoji).containsExactly("👍", "❤️");
        var mine = chat.getReactionStates(alice.getUsername(), conversationId, List.of(message.messageId())).items().getFirst();
        assertThat(mine.reactions().get(0).reactedByMe()).isFalse();
        assertThat(mine.reactions().get(1).count()).isEqualTo(2);
        assertThat(mine.reactions().get(1).reactedByMe()).isTrue();
        assertThat(chat.listMessages(alice.getUsername(), conversationId, 20).items().getFirst().reactions()).isEqualTo(mine.reactions());
        var removed = chat.setReaction(alice.getUsername(), conversationId, message.messageId(), "heart", false);
        assertThat(removed.reactions().get(1).count()).isEqualTo(1);
        assertThat(removed.reactions().get(1).reactedByMe()).isFalse();
        assertThat(chat.setReaction(alice.getUsername(), conversationId, message.messageId(), "heart", false)).isEqualTo(removed);
        assertThat(events.items).hasSize(4);
        assertThat(events.items.getLast().version()).isEqualTo(4);
        assertThat(events.items.getLast().conversationId()).isEqualTo(conversationId);
        assertThat(events.items.getLast().messageId()).isEqualTo(message.messageId());
    }

    @Test void concurrentDuplicateReactionsPersistOnce() throws Exception {
        var message = chat.sendMessage(alice.getUsername(), conversationId, new SendMessageRequest("race"));
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            Callable<ChatDtos.MessageReactionState> action = () -> { start.await(); return chat.setReaction(alice.getUsername(), conversationId, message.messageId(), "laugh", true); };
            var a = executor.submit(action); var b = executor.submit(action); start.countDown();
            assertThat(a.get(10, TimeUnit.SECONDS).version()).isEqualTo(1);
            assertThat(b.get(10, TimeUnit.SECONDS).version()).isEqualTo(1);
            assertThat(reactions.count()).isEqualTo(1);
            assertThat(chat.getReactionStates(bob.getUsername(), conversationId, List.of(message.messageId())).items().getFirst().reactions().getFirst().count()).isEqualTo(1);
        } finally { executor.shutdownNow(); }
    }

    @Test void reactionRestEnforcesAuthenticationMembershipTargetAndEmoji() throws Exception {
        var message = chat.sendMessage(alice.getUsername(), conversationId, new SendMessageRequest("security"));
        String path = "/api/v1/chats/" + conversationId + "/messages/" + message.messageId() + "/reactions/heart";
        mvc.perform(put(path)).andExpect(status().isUnauthorized());
        mvc.perform(put(path).header("Authorization", bearer(outsider))).andExpect(status().isForbidden());
        mvc.perform(put(path.replace("heart", "unsupported")).header("Authorization", bearer(alice))).andExpect(status().isBadRequest());
        mvc.perform(put(path).header("Authorization", bearer(alice))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reactions[0].reactedByMe").value(true));
        mvc.perform(delete(path).header("Authorization", bearer(alice))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reactions").isEmpty());
        Long other = direct("actions-cross");
        assertThatThrownBy(() -> chat.setReaction(alice.getUsername(), other, message.messageId(), "heart", true)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> chat.getReactionStates(alice.getUsername(), other, List.of(message.messageId()))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> chat.getReactionStates(outsider.getUsername(), conversationId, List.of(message.messageId()))).isInstanceOf(AccessDeniedException.class);
    }

    @Test void groupRepliesRemovedMemberAndHardDeleteCleanup() {
        Long id = groups.createGroup(alice.getUsername(), new CreateGroupRequest("Actions group", List.of())).groupId();
        var original = chat.sendMessage(alice.getUsername(), id, new SendMessageRequest("group original"));
        chat.sendMessage(alice.getUsername(), id, new SendMessageRequest("self reply", original.messageId()));
        chat.setReaction(alice.getUsername(), id, original.messageId(), "sad", true);
        participants.save(new ConversationParticipant(id, bob.getId()));
        chat.setReaction(bob.getUsername(), id, original.messageId(), "angry", true);
        groups.removeMember(alice.getUsername(), id, bob.getId());
        assertThatThrownBy(() -> chat.setReaction(bob.getUsername(), id, original.messageId(), "laugh", true)).isInstanceOf(AccessDeniedException.class);
        groups.deleteGroup(alice.getUsername(), id);
        assertThat(messages.countByConversationId(id)).isZero();
        assertThat(reactions.count()).isZero();
        assertThatThrownBy(() -> chat.setReaction(alice.getUsername(), id, original.messageId(), "heart", true))
                .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
    }

    private Long direct(String key) {
        Conversation conversation = new Conversation(); conversation.setType("DIRECT"); conversation.setConversationKey(key);
        Long id = conversations.save(conversation).getId();
        participants.save(new ConversationParticipant(id, alice.getId())); participants.save(new ConversationParticipant(id, bob.getId()));
        return id;
    }
    private User user(String username, String displayName) {
        User user = new User(); user.setUsername(username); user.setDisplayName(displayName); user.setPasswordHash("test-hash");
        return users.save(user);
    }
    private String bearer(User user) { return "Bearer " + jwt.generateToken(user.getId(), user.getUsername()); }
}
