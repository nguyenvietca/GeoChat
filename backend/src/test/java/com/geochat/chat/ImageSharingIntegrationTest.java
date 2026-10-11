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
@org.springframework.test.context.TestPropertySource(properties="geochat.upload.storage-path=./target/test-images")
class ImageSharingIntegrationTest {
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
    @Autowired com.geochat.chat.service.ImageStorage storage;
    @Autowired com.geochat.chat.repository.MessageAttachmentRepository attachments;
    @Autowired com.geochat.chat.service.ImageCleanup cleanup;
    @org.springframework.test.context.bean.override.mockito.MockitoBean org.springframework.messaging.simp.SimpMessagingTemplate socket;
    MockMvc mvc;
    User alice, bob, outsider;
    Long conversationId;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
        reactions.deleteAll(); messages.deleteAll(); participants.deleteAll(); conversations.deleteAll();
        locations.deleteAll(); friends.deleteAll(); users.deleteAll();
        alice = user("actions-alice", "Alice"); bob = user("actions-bob", "Bob"); outsider = user("actions-outsider", "Outsider");
        conversationId = direct("actions-primary");
    }


    private org.springframework.mock.web.MockMultipartFile image(String format) throws Exception {
        byte[] bytes;
        if(format.equals("webp"))try(var input=getClass().getResourceAsStream("/images/valid.webp")){bytes=input.readAllBytes();}
        else {var out=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(12,8,java.awt.image.BufferedImage.TYPE_INT_RGB),format,out);bytes=out.toByteArray();}
        return new org.springframework.mock.web.MockMultipartFile("image","../../photo."+format,"image/"+format,bytes);
    }
    @Test void jpegPngWebpPersistNormalizeAndRemainPrivate() throws Exception {
        for(String format:List.of("jpeg","png","webp")) {
            var saved=chat.sendImage(alice.getUsername(),conversationId,image(format),"caption",null,java.util.UUID.randomUUID().toString());
            assertThat(saved.attachment()).isNotNull(); assertThat(saved.attachment().width()).isEqualTo(12);
            assertThat(saved.attachment().height()).isEqualTo(8);assertThat(saved.content()).isEqualTo("caption");
            mvc.perform(get("/api/v1/chats/images/"+saved.attachment().attachmentId()).header("Authorization",bearer(bob))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
            mvc.perform(get("/api/v1/chats/images/"+saved.attachment().attachmentId()).header("Authorization",bearer(outsider))).andExpect(status().isNotFound());
            mvc.perform(get("/api/v1/chats/images/"+saved.attachment().attachmentId())).andExpect(status().isUnauthorized());
        }
        assertThat(chat.listMessages(bob.getUsername(),conversationId,20).items()).allMatch(item->item.attachment()!=null);
        assertThat(chat.listConversations(bob.getUsername()).items().getFirst().lastMessage()).isEqualTo("Photo: caption");
    }
    @Test void imageOnlyCaptionReplyAndDuplicateRetryUseOneMessage() throws Exception {
        String key=java.util.UUID.randomUUID().toString();
        var first=chat.sendImage(alice.getUsername(),conversationId,image("png"),"",null,key);
        var second=chat.sendImage(alice.getUsername(),conversationId,image("png"),"",null,key);
        assertThat(second.messageId()).isEqualTo(first.messageId());assertThat(messages.count()).isEqualTo(1);
        assertThatThrownBy(()->chat.sendImage(bob.getUsername(),conversationId,image("png"),"",null,key)).isInstanceOf(AccessDeniedException.class);
        var reply=chat.sendImage(bob.getUsername(),conversationId,image("jpeg"),"response",first.messageId(),java.util.UUID.randomUUID().toString());
        assertThat(reply.replyToMessageId()).isEqualTo(first.messageId());
        chat.setReaction(alice.getUsername(),conversationId,reply.messageId(),"heart",true);
        assertThat(chat.getReactionStates(alice.getUsername(),conversationId,List.of(reply.messageId())).items().getFirst().reactions()).hasSize(1);
    }
    @Test void multipartRequiresJwtAndBroadcastsSafeMetadata() throws Exception {
        var file=image("png");String key=java.util.UUID.randomUUID().toString();
        mvc.perform(multipart("/api/v1/chats/"+conversationId+"/images").file(file).param("requestId",key)).andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/v1/chats/"+conversationId+"/images").file(file).param("requestId",key).header("Authorization",bearer(outsider))).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/v1/chats/"+conversationId+"/images").file(file).param("requestId",key).header("Authorization",bearer(alice)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.attachment.width").value(12)).andExpect(jsonPath("$.data.attachment.storageKey").doesNotExist());
        org.mockito.Mockito.verify(socket).convertAndSend(org.mockito.ArgumentMatchers.eq("/topic/chat/"+conversationId),org.mockito.ArgumentMatchers.any(com.geochat.chat.dto.ChatDtos.MessageResponse.class));
    }
    @Test void invalidUploadsAndReplyFailureLeaveNoBoundImage() throws Exception {
        var png=image("png");
        var spoof=new org.springframework.mock.web.MockMultipartFile("image","file.jpg","image/jpeg",png.getBytes());
        var empty=new org.springframework.mock.web.MockMultipartFile("image","empty.png","image/png",new byte[0]);
        var invalid=new org.springframework.mock.web.MockMultipartFile("image","file.png","image/png","<html>fake</html>".getBytes());
        var oversized=new org.springframework.mock.web.MockMultipartFile("image","big.png","image/png",new byte[5242881]);
        var svg=new org.springframework.mock.web.MockMultipartFile("image","file.svg","image/svg+xml","<svg/>".getBytes());
        for(var file:List.of(spoof,empty,invalid,oversized,svg))assertThatThrownBy(()->chat.sendImage(alice.getUsername(),conversationId,file,"",null,java.util.UUID.randomUUID().toString())).isInstanceOf(IllegalArgumentException.class);
        int files=storage.files().size();
        assertThatThrownBy(()->chat.sendImage(alice.getUsername(),conversationId,png,"",999999L,java.util.UUID.randomUUID().toString())).isInstanceOf(IllegalArgumentException.class);
        assertThat(storage.files()).hasSize(files);assertThat(attachments.count()).isZero();
        assertThatThrownBy(()->storage.resolve("../../.env")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->storage.resolve("C:/secret.png")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void removedGroupMemberCannotReadAndDeletionCleansFilesAfterCommit() throws Exception {
        Long id=groups.createGroup(alice.getUsername(),new CreateGroupRequest("Photos",List.of())).groupId();
        participants.save(new ConversationParticipant(id,bob.getId()));
        var message=chat.sendImage(alice.getUsername(),id,image("png"),"group",null,java.util.UUID.randomUUID().toString());
        String key=attachments.findById(message.attachment().attachmentId()).orElseThrow().getStorageKey();
        assertThat(java.nio.file.Files.exists(storage.resolve(key))).isTrue();
        assertThat(chat.authorizedImage(bob.getUsername(),message.attachment().attachmentId())).isNotNull();
        groups.removeMember(alice.getUsername(),id,bob.getId());
        assertThatThrownBy(()->chat.authorizedImage(bob.getUsername(),message.attachment().attachmentId())).isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
        groups.deleteGroup(alice.getUsername(),id);
        assertThat(attachments.count()).isZero();assertThat(java.nio.file.Files.exists(storage.resolve(key))).isFalse();
    }
    @Test void orphanSweepPreservesBoundAndRecentFiles() throws Exception {
        var saved=chat.sendImage(alice.getUsername(),conversationId,image("png"),"",null,java.util.UUID.randomUUID().toString());
        String bound=attachments.findById(saved.attachment().attachmentId()).orElseThrow().getStorageKey();
        var orphan=storage.store(image("png"));var recent=storage.store(image("png"));
        var old=java.nio.file.attribute.FileTime.from(java.time.Instant.now().minusSeconds(7200));
        java.nio.file.Files.setLastModifiedTime(storage.resolve(bound),old);java.nio.file.Files.setLastModifiedTime(storage.resolve(orphan.key()),old);
        cleanup.cleanOrphans();assertThat(java.nio.file.Files.exists(storage.resolve(bound))).isTrue();
        assertThat(java.nio.file.Files.exists(storage.resolve(orphan.key()))).isFalse();assertThat(java.nio.file.Files.exists(storage.resolve(recent.key()))).isTrue();
    }
    @Test void concurrentImageRetriesAndOversizedDimensionsAreSafe() throws Exception {
        String key=java.util.UUID.randomUUID().toString();
        var executor=Executors.newFixedThreadPool(2);
        try {
            Callable<Long> action=()->chat.sendImage(alice.getUsername(),conversationId,image("png"),"caption",null,key).messageId();
            var results=executor.invokeAll(List.of(action,action));
            assertThat(results.get(0).get()).isEqualTo(results.get(1).get());assertThat(messages.count()).isEqualTo(1);
        } finally {executor.shutdownNow();}
        var output=new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(4097,1,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",output);
        var huge=new org.springframework.mock.web.MockMultipartFile("image","huge.png","image/png",output.toByteArray());
        assertThatThrownBy(()->storage.store(huge)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("dimensions");
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
