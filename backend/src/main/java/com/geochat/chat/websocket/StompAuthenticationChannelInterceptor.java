package com.geochat.chat.websocket;

import com.geochat.auth.security.JwtService;
import com.geochat.chat.service.ChatService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class StompAuthenticationChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final ChatService chatService;
    private final WebSocketSessionRegistry webSocketSessionRegistry;
    private final RealtimeRequestGuard realtimeRequestGuard;

    public StompAuthenticationChannelInterceptor(JwtService jwtService,
                                                UserDetailsService userDetailsService,
                                                ChatService chatService,
                                                WebSocketSessionRegistry webSocketSessionRegistry,
                                                RealtimeRequestGuard realtimeRequestGuard) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.chatService = chatService;
        this.webSocketSessionRegistry = webSocketSessionRegistry;
        this.realtimeRequestGuard = realtimeRequestGuard;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            throw new AccessDeniedException("Authentication required");
        }
        if (accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = resolveToken(accessor);
            if (token == null || !jwtService.isTokenValid(token)) {
                throw new AccessDeniedException("Missing or invalid JWT token");
            }

            String username = jwtService.getUsername(token);
            UserDetails userDetails;
            try {
                userDetails = userDetailsService.loadUserByUsername(username);
            } catch (UsernameNotFoundException exception) {
                throw new AccessDeniedException("Missing or invalid JWT token");
            }
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
            accessor.setUser(authentication);

            Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
            if (sessionAttributes == null) {
                sessionAttributes = new java.util.HashMap<>();
            }
            sessionAttributes.put("username", username);
            sessionAttributes.put("jwtExpiresAt", jwtService.getExpiration(token).toEpochMilli());
            accessor.setSessionAttributes(sessionAttributes);
            webSocketSessionRegistry.registerUsername(accessor.getSessionId(), username, jwtService.getUserId(token));
            webSocketSessionRegistry.scheduleExpiration(accessor.getSessionId(), jwtService.getExpiration(token));
            return message;
        }

        if (StompCommand.DISCONNECT.equals(accessor.getCommand())) {
            webSocketSessionRegistry.disconnect(accessor.getSessionId());
            return message;
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand()) || StompCommand.SEND.equals(accessor.getCommand())) {
            String username = resolveUsername(accessor);
            String destination = accessor.getDestination();
            realtimeRequestGuard.check(username, StompCommand.SUBSCRIBE.equals(accessor.getCommand()) ? "subscribe"
                    : destination != null && destination.endsWith("/typing") ? "typing" : "message",
                    StompCommand.SUBSCRIBE.equals(accessor.getCommand()) ? 100
                            : destination != null && destination.endsWith("/typing") ? 240 : 120);
            if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                if ("/user/queue/notifications".equals(destination)
                        || "/user/queue/group-events".equals(destination)
                        || "/user/queue/conversation-activity".equals(destination)
                        || "/user/queue/conversation-read".equals(destination)) {
                    return message;
                }
                Long presenceUserId = extractConversationId(destination, "/topic/presence/", "");
                if (presenceUserId != null) {
                    if (!chatService.canViewPresence(username, presenceUserId)) {
                        throw new AccessDeniedException("You cannot view this user's presence.");
                    }
                    return message;
                }
            }

            Long conversationId = StompCommand.SUBSCRIBE.equals(accessor.getCommand())
                    ? extractConversationId(destination, "/topic/chat/",
                        destination != null && destination.endsWith("/typing") ? "/typing"
                        : destination != null && destination.endsWith("/reactions") ? "/reactions" : "")
                    : extractConversationId(destination, "/app/chat/",
                        destination != null && destination.endsWith("/typing") ? "/typing" : "/send");
            if (conversationId == null) {
                throw new AccessDeniedException("Invalid realtime destination");
            }

            if (!chatService.isParticipant(username, conversationId)) {
                throw new AccessDeniedException("You cannot access this conversation.");
            }
        }

        return message;
    }

    private String resolveUsername(StompHeaderAccessor accessor) {
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        String sessionUsername = sessionAttributes == null || sessionAttributes.get("username") == null ? null
                : sessionAttributes.get("username").toString();
        long expiresAt = sessionAttributes != null && sessionAttributes.get("jwtExpiresAt") instanceof Number value
                ? value.longValue() : 0;
        String principalUsername = accessor.getUser() == null ? null : accessor.getUser().getName();
        if (sessionUsername == null || expiresAt <= System.currentTimeMillis()
                || (principalUsername != null && !sessionUsername.equals(principalUsername))) {
            throw new AccessDeniedException("Authentication required");
        }
        return sessionUsername;
    }

    private String resolveToken(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7).trim();
        }

        return null;
    }

    private Long extractConversationId(String destination, String prefix, String suffix) {
        if (destination == null || !destination.startsWith(prefix) || !destination.endsWith(suffix)) {
            return null;
        }

        String idPart = destination.substring(prefix.length(), destination.length() - suffix.length());
        if (idPart.isBlank() || idPart.contains("/")) {
            return null;
        }

        try {
            long conversationId = Long.parseLong(idPart);
            return conversationId > 0 ? conversationId : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
