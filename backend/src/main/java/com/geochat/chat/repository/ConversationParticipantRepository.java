package com.geochat.chat.repository;

import com.geochat.chat.entity.ConversationParticipant;
import com.geochat.chat.entity.ConversationParticipantId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationParticipantRepository extends JpaRepository<ConversationParticipant, ConversationParticipantId> {

    @Query("select cp from ConversationParticipant cp where cp.id.userId = :userId order by cp.id.conversationId desc")
    List<ConversationParticipant> findByUserIdOrderByConversationIdDesc(@Param("userId") Long userId);

    @Query("select cp from ConversationParticipant cp where cp.id.conversationId = :conversationId order by cp.id.userId asc")
    List<ConversationParticipant> findByConversationIdOrderByIdAsc(@Param("conversationId") Long conversationId);

    @Query("select cp from ConversationParticipant cp where cp.id.conversationId = :conversationId and cp.id.userId <> :userId")
    List<ConversationParticipant> findOtherParticipants(@Param("conversationId") Long conversationId, @Param("userId") Long userId);

    @Query("select cp from ConversationParticipant cp where cp.id.conversationId = :conversationId and cp.id.userId = :userId")
    Optional<ConversationParticipant> findByConversationIdAndUserId(@Param("conversationId") Long conversationId, @Param("userId") Long userId);

    @Query("select count(cp) > 0 from ConversationParticipant cp where cp.id.conversationId = :conversationId and cp.id.userId = :userId")
    boolean existsByConversationIdAndUserId(@Param("conversationId") Long conversationId, @Param("userId") Long userId);

    @Query("select count(cp) from ConversationParticipant cp where cp.id.conversationId = :conversationId")
    long countByConversationId(@Param("conversationId") Long conversationId);

    @Query("select count(groupMember) > 0 from ConversationParticipant firstMember, "
            + "ConversationParticipant groupMember, Conversation conversation "
            + "where conversation.id = firstMember.id.conversationId "
            + "and conversation.id = groupMember.id.conversationId "
            + "and conversation.type = 'GROUP' "
            + "and firstMember.id.userId = :firstUserId and groupMember.id.userId = :secondUserId")
    boolean shareGroup(@Param("firstUserId") Long firstUserId, @Param("secondUserId") Long secondUserId);

    @Query("select count(firstMember) > 0 from ConversationParticipant firstMember, "
            + "ConversationParticipant secondMember, Conversation conversation "
            + "where conversation.id = firstMember.id.conversationId "
            + "and conversation.id = secondMember.id.conversationId "
            + "and conversation.type = 'DIRECT' "
            + "and firstMember.id.userId = :firstUserId and secondMember.id.userId = :secondUserId")
    boolean shareDirectConversation(@Param("firstUserId") Long firstUserId, @Param("secondUserId") Long secondUserId);
}
