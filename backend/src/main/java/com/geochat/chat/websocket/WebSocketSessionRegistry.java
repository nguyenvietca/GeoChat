package com.geochat.chat.websocket;

import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Component
public class WebSocketSessionRegistry {

    private final ConcurrentMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ScheduledFuture<?>> expirationTasks = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(task -> {
        Thread thread = new Thread(task, "geochat-websocket-expiration");
        thread.setDaemon(true);
        return thread;
    });

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

    public void remove(String sessionId) {
        sessions.remove(sessionId);
        ScheduledFuture<?> task = expirationTasks.remove(sessionId);
        if (task != null) {
            task.cancel(false);
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