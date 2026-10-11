package com.geochat.chat.service;
import com.geochat.chat.repository.MessageAttachmentRepository;
import com.geochat.chat.event.ChatImagesDeletedEvent;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.*;
import org.springframework.transaction.event.TransactionalEventListener;
import java.nio.file.*;
import java.time.Instant;
@Component @EnableScheduling
public class ImageCleanup {
 private final ImageStorage storage;private final MessageAttachmentRepository attachments;
 public ImageCleanup(ImageStorage storage,MessageAttachmentRepository attachments){this.storage=storage;this.attachments=attachments;}
 @TransactionalEventListener public void deleted(ChatImagesDeletedEvent event){for(String key:event.keys()) deleteQuietly(key);}
 private void deleteQuietly(String key){try{storage.delete(key);}catch(RuntimeException ex){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Image cleanup deferred for retry");}}
 @Scheduled(fixedDelayString="${geochat.upload.cleanup-interval-ms:3600000}",initialDelayString="${geochat.upload.cleanup-interval-ms:3600000}")
 public void cleanOrphans(){for(Path path:storage.files())try{
  if(Files.getLastModifiedTime(path).toInstant().isBefore(Instant.now().minusSeconds(3600))&&!attachments.existsByStorageKey(path.getFileName().toString()))deleteQuietly(path.getFileName().toString());
 }catch(java.io.IOException ignored){}}
}
