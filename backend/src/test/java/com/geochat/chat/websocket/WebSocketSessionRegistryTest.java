package com.geochat.chat.websocket;

import com.geochat.chat.event.WebSocketPresenceChangedEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WebSocketSessionRegistryTest {
    private final ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
    private final WebSocketSessionRegistry registry = new WebSocketSessionRegistry(publisher);

    @AfterEach void cleanup() { registry.shutdown(); }

    @Test void repeatedRegistrationAndPartialDisconnectDoNotEmitDuplicateTransitions() {
        registry.registerUsername("a", "alice", 1L);
        registry.registerUsername("a", "alice", 1L);
        registry.registerUsername("b", "alice", 1L);
        registry.disconnect("a");
        registry.disconnect("a");
        assertThat(registry.isOnline(1L)).isTrue();
        verify(publisher, times(1)).publishEvent(new WebSocketPresenceChangedEvent(1L, true));
        registry.remove("b");
        registry.remove("b");
        assertThat(registry.isOnline(1L)).isFalse();
        verify(publisher, times(1)).publishEvent(new WebSocketPresenceChangedEvent(1L, false));
        verifyNoMoreInteractions(publisher);
    }

    @Test void expirationRemovesAStaleFinalSession() {
        WebSocketSession socket = mock(WebSocketSession.class);
        when(socket.getId()).thenReturn("expired");
        when(socket.isOpen()).thenReturn(false);
        registry.register(socket);
        registry.registerUsername("expired", "alice", 1L);
        registry.scheduleExpiration("expired", Instant.now());
        org.awaitility.Awaitility.await().atMost(2, TimeUnit.SECONDS).untilAsserted(() -> {
            assertThat(registry.isOnline(1L)).isFalse();
            verify(publisher).publishEvent(new WebSocketPresenceChangedEvent(1L, false));
        });
        assertThat(registry.getUsername("expired")).isNull();
    }

    @Test void concurrentRegisterAndDisconnectPublishTransitionsInConnectivityOrder() throws Exception {
        var onlineStarted = new CountDownLatch(1);
        var releaseOnline = new CountDownLatch(1);
        var disconnectStarted = new CountDownLatch(1);
        var events = new CopyOnWriteArrayList<WebSocketPresenceChangedEvent>();
        doAnswer(invocation -> {
            var event = (WebSocketPresenceChangedEvent) invocation.getArgument(0);
            if (event.online()) { onlineStarted.countDown(); releaseOnline.await(2, TimeUnit.SECONDS); }
            events.add(event);
            return null;
        }).when(publisher).publishEvent(any(WebSocketPresenceChangedEvent.class));
        var threads = Executors.newFixedThreadPool(2);
        try {
            var registered = threads.submit(() -> registry.registerUsername("race", "alice", 1L));
            assertThat(onlineStarted.await(1, TimeUnit.SECONDS)).isTrue();
            var disconnected = threads.submit(() -> { disconnectStarted.countDown(); registry.disconnect("race"); });
            assertThat(disconnectStarted.await(1, TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> disconnected.get(100, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            releaseOnline.countDown();
            registered.get(2, TimeUnit.SECONDS); disconnected.get(2, TimeUnit.SECONDS);
            assertThat(events).containsExactly(new WebSocketPresenceChangedEvent(1L, true), new WebSocketPresenceChangedEvent(1L, false));
            assertThat(registry.isOnline(1L)).isFalse();
        } finally { releaseOnline.countDown(); threads.shutdownNow(); }
    }
}
