package com.geochat.chat.entity;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
@Entity
@Table(name="message_attachments", uniqueConstraints={@UniqueConstraint(columnNames="message_id"), @UniqueConstraint(columnNames="request_id"), @UniqueConstraint(columnNames="storage_key")})
public class MessageAttachment {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="message_id",nullable=false) private Long messageId;
 @Column(name="conversation_id",nullable=false) private Long conversationId;
 @Column(name="uploader_id",nullable=false) private Long uploaderId;
 @Column(name="request_id",nullable=false,length=36) private String requestId;
 @Column(name="storage_key",nullable=false,length=64) private String storageKey;
 @Column(name="original_filename",nullable=false,length=160) private String originalFilename;
 @Column(name="content_type",nullable=false,length=32) private String contentType;
 @Column(name="size_bytes",nullable=false) private long sizeBytes;
 @Column(nullable=false) private int width;
 @Column(nullable=false) private int height;
 @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="message_id",insertable=false,updatable=false) @OnDelete(action=OnDeleteAction.CASCADE) private Message message;
 public MessageAttachment() {}
 public MessageAttachment(Long messageId,Long conversationId,Long uploaderId,String requestId,com.geochat.chat.service.ImageStorage.Stored image) {
  this.messageId=messageId;this.conversationId=conversationId;this.uploaderId=uploaderId;this.requestId=requestId;
  storageKey=image.key();originalFilename=image.filename();contentType=image.contentType();sizeBytes=image.size();width=image.width();height=image.height();
 }
 public Long getId(){return id;} public Long getMessageId(){return messageId;} public Long getConversationId(){return conversationId;}
 public Long getUploaderId(){return uploaderId;} public String getRequestId(){return requestId;} public String getStorageKey(){return storageKey;}
 public String getContentType(){return contentType;} public long getSizeBytes(){return sizeBytes;} public int getWidth(){return width;} public int getHeight(){return height;}
}
