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

    List<ConversationParticipant> findByIdConversationIdIn(List<Long> conversationIds);

    @Query("""
            select count(participant) > 0 from ConversationParticipant participant, User user, Conversation conversation
            where participant.id.userId = user.id and participant.id.conversationId = conversation.id
              and conversation.id = :conversationId and lower(user.username) = lower(:username)
            """)
    boolean existsForUsername(@Param("conversationId") Long conversationId, @Param("username") String username);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true)
    @Query("update ConversationParticipant p set p.readStateVersion = p.readStateVersion + 1 where p.id.conversationId = :conversationId")
    void advanceReadStateVersions(@Param("conversationId") Long conversationId);

    @Query("""
            select p.id.conversationId as conversationId, p.id.userId as userId,
                   count(m.id) as unreadCount, p.readStateVersion as readStateVersion, p.createdAt as readStateSince
            from ConversationParticipant p left join Message m
              on m.conversationId = p.id.conversationId and m.senderId <> p.id.userId
              and (p.lastReadMessageAt is null or m.createdAt > p.lastReadMessageAt
                   or (m.createdAt = p.lastReadMessageAt and m.id > p.lastReadMessageId))
            where p.id.userId = :userId and p.id.conversationId in :ids
            group by p.id.conversationId, p.id.userId, p.readStateVersion, p.createdAt
            """)
    List<UnreadStateRow> findUnreadStates(@Param("userId") Long userId, @Param("ids") List<Long> ids);

    @Query("""
            select p.id.conversationId as conversationId, p.id.userId as userId,
                   count(m.id) as unreadCount, p.readStateVersion as readStateVersion, p.createdAt as readStateSince
            from ConversationParticipant p left join Message m
              on m.conversationId = p.id.conversationId and m.senderId <> p.id.userId
              and (p.lastReadMessageAt is null or m.createdAt > p.lastReadMessageAt
                   or (m.createdAt = p.lastReadMessageAt and m.id > p.lastReadMessageId))
            where p.id.conversationId = :conversationId
            group by p.id.conversationId, p.id.userId, p.readStateVersion, p.createdAt
            """)
    List<UnreadStateRow> findUnreadStatesForConversation(@Param("conversationId") Long conversationId);

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
