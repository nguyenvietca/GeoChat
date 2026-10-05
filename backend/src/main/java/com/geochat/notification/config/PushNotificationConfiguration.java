package com.geochat.notification.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class PushNotificationConfiguration {

	@Bean
	RestClient expoPushRestClient(
			@Value("${push-notifications.expo.url:https://exp.host/--/api/v2/push/send}") String url) {
		SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(3000);
		requestFactory.setReadTimeout(5000);
		return RestClient.builder().baseUrl(url).requestFactory(requestFactory).build();
	}
}