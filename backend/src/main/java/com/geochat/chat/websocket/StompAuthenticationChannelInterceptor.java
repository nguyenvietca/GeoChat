package com.geochat.chat.websocket;

import com.geochat.auth.security.JwtService;
import com.geochat.chat.service.ChatService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class StompAuthenticationChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final ChatService chatService;

    public StompAuthenticationChannelInterceptor(JwtService jwtService,
                                                UserDetailsService userDetailsService,
                                                ChatService chatService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.chatService = chatService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = resolveToken(accessor);
            if (token == null) {
                throw new AccessDeniedException("Missing or invalid JWT token");
            }

            String username = jwtService.getUsername(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
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
            return message;
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand()) || StompCommand.SEND.equals(accessor.getCommand())) {
            String username = resolveUsername(accessor);
            if (username == null || username.isBlank()) {
                throw new AccessDeniedException("Authentication required");
            }

            String destination = accessor.getDestination();
            if (destination != null && destination.startsWith("/user/")) {
                return message;
            }

            Long conversationId = extractConversationId(destination);
            if (conversationId == null) {
                throw new IllegalArgumentException("Invalid conversation destination");
            }

            if (!chatService.isParticipant(username, conversationId)) {
                throw new AccessDeniedException("You cannot access this conversation.");
            }
        }

        return message;
    }

    private String resolveUsername(StompHeaderAccessor accessor) {
        if (accessor.getUser() != null) {
            return accessor.getUser().getName();
        }

        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes != null && sessionAttributes.containsKey("username")) {
            Object value = sessionAttributes.get("username");
            if (value != null) {
                return value.toString();
            }
        }

        String token = resolveToken(accessor);
        if (token == null) {
            return null;
        }
        return jwtService.getUsername(token);
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

    private Long extractConversationId(String destination) {
        if (destination == null) {
            return null;
        }

        String normalized = destination.trim();
        String[] segments = normalized.split("/");
        if (segments.length >= 4 && "chat".equals(segments[2])) {
            try {
                return Long.parseLong(segments[3].split("(?=\\/|$)")[0]);
            } catch (NumberFormatException ex) {
                return null;
            }
        }

        if (normalized.startsWith("/app/chat/")) {
            String suffix = normalized.substring("/app/chat/".length());
            String idPart = suffix.contains("/") ? suffix.substring(0, suffix.indexOf('/')) : suffix;
            try {
                return Long.parseLong(idPart);
            } catch (NumberFormatException ex) {
                return null;
            }
        }

        if (normalized.startsWith("/topic/chat/")) {
            String idPart = normalized.substring("/topic/chat/".length());
            try {
                return Long.parseLong(idPart);
            } catch (NumberFormatException ex) {
                return null;
            }
        }

        return null;
    }
}
