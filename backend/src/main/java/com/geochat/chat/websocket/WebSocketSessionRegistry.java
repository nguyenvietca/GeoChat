package com.geochat.chat.websocket;

import jakarta.annotation.PreDestroy;
import com.geochat.chat.event.WebSocketPresenceChangedEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Component
public class WebSocketSessionRegistry {

    private final ConcurrentMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> usernames = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Long> sessionUserIds = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, Integer> activeSessionCounts = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ScheduledFuture<?>> expirationTasks = new ConcurrentHashMap<>();
    private final ApplicationEventPublisher eventPublisher;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(task -> {
        Thread thread = new Thread(task, "geochat-websocket-expiration");
        thread.setDaemon(true);
        return thread;
    });

    public WebSocketSessionRegistry(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    public void register(WebSocketSession session) {
        sessions.put(session.getId(), session);
    }

    public void scheduleExpiration(String sessionId, Instant expiresAt) {
        long delayMs = Math.max(0, Duration.between(Instant.now(), expiresAt).toMillis());
        ScheduledFuture<?> task = scheduler.schedule(() -> closeSession(sessionId), delayMs, TimeUnit.MILLISECONDS);
        ScheduledFuture<?> previousTask = expirationTasks.put(sessionId, task);
        if (previousTask != null) {
            previousTask.cancel(false);
        }
    }

    public void registerUsername(String sessionId, String username, Long userId) {
        usernames.put(sessionId, username);
        if (sessionUserIds.putIfAbsent(sessionId, userId) == null) {
            int sessionCount = activeSessionCounts.merge(userId, 1, Integer::sum);
            if (sessionCount == 1) {
                eventPublisher.publishEvent(new WebSocketPresenceChangedEvent(userId, true));
            }
        }
    }

    public String getUsername(String sessionId) {
        return usernames.get(sessionId);
    }

    public boolean isOnline(Long userId) {
        return activeSessionCounts.containsKey(userId);
    }

    public void disconnect(String sessionId) {
        unregisterUsername(sessionId);
        ScheduledFuture<?> task = expirationTasks.remove(sessionId);
        if (task != null) task.cancel(false);
    }

    public void remove(String sessionId) {
        sessions.remove(sessionId);
        disconnect(sessionId);
    }

    private void unregisterUsername(String sessionId) {
        usernames.remove(sessionId);
        Long userId = sessionUserIds.remove(sessionId);
        if (userId == null) return;
        AtomicBoolean wentOffline = new AtomicBoolean();
        activeSessionCounts.computeIfPresent(userId, (id, count) -> {
            if (count <= 1) {
                wentOffline.set(true);
                return null;
            }
            return count - 1;
        });
        if (wentOffline.get()) {
            eventPublisher.publishEvent(new WebSocketPresenceChangedEvent(userId, false));
        }
    }

    private void closeSession(String sessionId) {
        WebSocketSession session = sessions.get(sessionId);
        if (session != null && session.isOpen()) {
            try {
                session.close(CloseStatus.POLICY_VIOLATION);
            } catch (IOException ignored) {
                remove(sessionId);
            }
        } else {
            remove(sessionId);
        }
    }

    @PreDestroy
    void shutdown() {
        scheduler.shutdownNow();
    }
}