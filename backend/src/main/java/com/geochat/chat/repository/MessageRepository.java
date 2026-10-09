package com.geochat.chat.repository;

import com.geochat.chat.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByConversationIdOrderByCreatedAtAscIdAsc(Long conversationId, Pageable pageable);

    List<Message> findByConversationIdOrderByCreatedAtDescIdDesc(Long conversationId, Pageable pageable);

    @Query("SELECT message FROM Message message WHERE message.conversationId IN :conversationIds "
            + "AND NOT EXISTS (SELECT newer FROM Message newer WHERE newer.conversationId = message.conversationId "
            + "AND (newer.createdAt > message.createdAt OR "
            + "(newer.createdAt = message.createdAt AND newer.id > message.id)))")
    List<Message> findLatestMessagesByConversationIds(@Param("conversationIds") List<Long> conversationIds);

    long countByConversationId(Long conversationId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("DELETE FROM Message message WHERE message.conversationId = :conversationId")
    void deleteAllByConversationId(@Param("conversationId") Long conversationId);
}
