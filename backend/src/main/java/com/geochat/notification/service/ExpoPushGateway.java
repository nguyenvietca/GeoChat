package com.geochat.notification.service;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class ExpoPushGateway {

    private final RestClient restClient;
    private final String accessToken;

    public ExpoPushGateway(
            @Qualifier("expoPushRestClient") RestClient restClient,
            @Value("${push-notifications.expo.access-token:}") String accessToken) {
        this.restClient = restClient;
        this.accessToken = accessToken;
    }

    public boolean send(String token, String title, String body, Map<String, Object> data) {
        var request = restClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "to", token,
                        "title", title,
                        "body", body,
                        "sound", "default",
                        "data", data));

        if (!accessToken.isBlank()) {
            request.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
        }

        Map<?, ?> response = request.retrieve().body(Map.class);
        Object ticketValue = response == null ? null : response.get("data");
        if (!(ticketValue instanceof Map<?, ?> ticket)) {
            return false;
        }
        Object detailsValue = ticket.get("details");
        if (!(detailsValue instanceof Map<?, ?> details)) {
            return false;
        }
        return "error".equals(ticket.get("status"))
                && "DeviceNotRegistered".equals(details.get("error"));
    }
}