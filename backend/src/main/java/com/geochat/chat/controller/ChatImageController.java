package com.geochat.chat.controller;

import com.geochat.chat.service.*;
import com.geochat.chat.dto.ChatDtos.MessageResponse;
import com.geochat.common.response.ApiResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@RestController
@RequestMapping("/api/v1/chats")
public class ChatImageController {
    private final ChatService chat;
    private final ImageStorage storage;
    private final SimpMessagingTemplate socket;
    public ChatImageController(ChatService chat, ImageStorage storage, SimpMessagingTemplate socket) {
        this.chat = chat; this.storage = storage; this.socket = socket;
    }
    @PostMapping(value="/{conversationId}/images", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<MessageResponse> send(@AuthenticationPrincipal UserDetails user, @PathVariable Long conversationId,
            @RequestParam MultipartFile image, @RequestParam(defaultValue="") String content,
            @RequestParam(required=false) Long replyToMessageId, @RequestParam String requestId) {
        var message = chat.sendImage(user.getUsername(), conversationId, image, content, replyToMessageId, requestId);
        socket.convertAndSend("/topic/chat/" + conversationId, message);
        return ApiResponse.ok(message);
    }
    @GetMapping("/images/{attachmentId}")
    public ResponseEntity<byte[]> read(@AuthenticationPrincipal UserDetails user, @PathVariable Long attachmentId) {
        var image = chat.authorizedImage(user.getUsername(), attachmentId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.getContentType())).cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff").header("Content-Disposition", "inline; filename=photo")
                .body(storage.read(image.getStorageKey()));
    }
}
