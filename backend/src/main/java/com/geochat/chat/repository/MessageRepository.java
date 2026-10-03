package com.geochat.chat.repository;

import com.geochat.chat.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByConversationIdOrderByCreatedAtAscIdAsc(Long conversationId, Pageable pageable);

    long countByConversationId(Long conversationId);
}
