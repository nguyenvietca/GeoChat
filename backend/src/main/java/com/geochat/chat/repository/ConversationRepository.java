package com.geochat.chat.repository;

import com.geochat.chat.entity.Conversation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    @Query("select conversation from Conversation conversation left join fetch conversation.owner where conversation.id in :ids")
    java.util.List<Conversation> findSummariesByIds(@Param("ids") java.util.List<Long> ids);

    Optional<Conversation> findByTypeAndConversationKey(String type, String conversationKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select conversation from Conversation conversation where conversation.id = :id")
    Optional<Conversation> findByIdForUpdate(@Param("id") Long id);
}
