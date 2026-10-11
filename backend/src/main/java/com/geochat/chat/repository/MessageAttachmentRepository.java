package com.geochat.chat.repository;
import com.geochat.chat.entity.MessageAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface MessageAttachmentRepository extends JpaRepository<MessageAttachment,Long> {
 List<MessageAttachment> findByMessageIdIn(Collection<Long> ids);
 List<MessageAttachment> findByConversationId(Long id);
 Optional<MessageAttachment> findByRequestId(String id);
 boolean existsByStorageKey(String key);
}
