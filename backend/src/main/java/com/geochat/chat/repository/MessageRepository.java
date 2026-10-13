package com.geochat.chat.repository;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.geochat.chat.entity.Message;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

	List<Message> findByConversationIdOrderByCreatedAtAscIdAsc(Long conversationId, Pageable pageable);

	List<Message> findByConversationIdOrderByCreatedAtDescIdDesc(Long conversationId, Pageable pageable);

	@Query("SELECT message FROM Message message WHERE message.conversationId = :conversationId "
			+ "AND (message.createdAt < :beforeCreatedAt OR "
			+ "(message.createdAt = :beforeCreatedAt AND message.id < :beforeId)) "
			+ "ORDER BY message.createdAt DESC, message.id DESC")
	List<Message> findOlderMessages(@Param("conversationId") Long conversationId,
			@Param("beforeCreatedAt") java.time.Instant beforeCreatedAt, @Param("beforeId") Long beforeId,
			Pageable pageable);

	@Query("SELECT message FROM Message message WHERE message.conversationId IN :conversationIds "
			+ "AND NOT EXISTS (SELECT newer FROM Message newer WHERE newer.conversationId = message.conversationId "
			+ "AND (newer.createdAt > message.createdAt OR "
			+ "(newer.createdAt = message.createdAt AND newer.id > message.id)))")
	List<Message> findLatestMessagesByConversationIds(@Param("conversationIds") List<Long> conversationIds);

	long countByConversationId(Long conversationId);

	long countByConversationIdAndSenderId(Long conversationId, Long senderId);

	@org.springframework.data.jpa.repository.Modifying
	@Query("DELETE FROM Message message WHERE message.conversationId = :conversationId")
	void deleteAllByConversationId(@Param("conversationId") Long conversationId);
}
