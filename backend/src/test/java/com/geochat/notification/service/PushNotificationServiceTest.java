package com.geochat.notification.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.geochat.notification.entity.UserPushDevice;
import com.geochat.notification.repository.UserPushDeviceRepository;

@ExtendWith(MockitoExtension.class)
class PushNotificationServiceTest {

    @Mock
    private UserPushDeviceRepository pushDeviceRepository;

    @Mock
    private ExpoPushGateway expoPushGateway;

    @Test
    void disabledPushDoesNotQueryDevicesOrCallProvider() {
        PushNotificationService service = new PushNotificationService(pushDeviceRepository, expoPushGateway, false);

        service.send(5L, "title", "body", Map.of());

        verifyNoInteractions(pushDeviceRepository, expoPushGateway);
    }

    @Test
    void repositoryFailureDoesNotEscapeThePushBoundary() {
        when(pushDeviceRepository.findByUserIdAndActiveTrue(5L)).thenThrow(new IllegalStateException("database offline"));
        PushNotificationService service = new PushNotificationService(pushDeviceRepository, expoPushGateway, true);

        assertDoesNotThrow(() -> service.send(5L, "title", "body", Map.of()));
        verifyNoInteractions(expoPushGateway);
    }

    @Test
    void providerFailureDoesNotEscapeThePushBoundary() {
        UserPushDevice device = device(7L);
        when(pushDeviceRepository.findByUserIdAndActiveTrue(5L)).thenReturn(List.of(device));
        doThrow(new IllegalStateException("provider offline"))
                .when(expoPushGateway).send(anyString(), anyString(), anyString(), anyMap());
        PushNotificationService service = new PushNotificationService(pushDeviceRepository, expoPushGateway, true);

        assertDoesNotThrow(() -> service.send(5L, "title", "body", Map.of()));
    }

    @Test
    void invalidProviderTokenDeactivatesOnlyThatDevice() {
        UserPushDevice device = device(7L);
        when(pushDeviceRepository.findByUserIdAndActiveTrue(5L)).thenReturn(List.of(device));
        when(expoPushGateway.send(anyString(), anyString(), anyString(), anyMap())).thenReturn(true);
        PushNotificationService service = new PushNotificationService(pushDeviceRepository, expoPushGateway, true);

        service.send(5L, "title", "body", Map.of());

        assertFalse(device.isActive());
        verify(pushDeviceRepository).save(device);
    }

    private UserPushDevice device(Long id) {
        UserPushDevice device = new UserPushDevice();
        device.setId(id);
        device.setUserId(5L);
        device.setPushToken("ExponentPushToken[" + id + "]");
        device.setPlatform("ios");
        return device;
    }
}