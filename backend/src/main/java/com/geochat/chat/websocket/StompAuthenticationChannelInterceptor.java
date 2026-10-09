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

    public StompAuthenticationChannelInterceptor(JwtService jwtService,
                                                UserDetailsService userDetailsService,
                                                ChatService chatService,
                                                WebSocketSessionRegistry webSocketSessionRegistry) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.chatService = chatService;
        this.webSocketSessionRegistry = webSocketSessionRegistry;
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
            sessionAttributes.put("jwtToken", token);
            sessionAttributes.put("username", username);
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
            if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                if ("/user/queue/notifications".equals(destination)
                        || "/user/queue/group-events".equals(destination)
                        || "/user/queue/conversation-activity".equals(destination)) {
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
                    ? extractConversationId(destination, "/topic/chat/", "")
                    : extractConversationId(destination, "/app/chat/", "/send");
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
        String token = resolveToken(accessor);
        if (token == null || !jwtService.isTokenValid(token)) {
            throw new AccessDeniedException("Authentication required");
        }

        String username = jwtService.getUsername(token);
        String sessionUsername = null;
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes != null && sessionAttributes.get("username") != null) {
            sessionUsername = sessionAttributes.get("username").toString();
        }
        if ((accessor.getUser() != null && !username.equals(accessor.getUser().getName()))
                || (accessor.getUser() == null && !username.equals(sessionUsername))) {
            throw new AccessDeniedException("Authentication required");
        }
        return username;
    }

    private String resolveToken(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7).trim();
        }

        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes != null && sessionAttributes.containsKey("jwtToken")) {
            Object token = sessionAttributes.get("jwtToken");
            if (token != null) {
                return token.toString();
            }
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
