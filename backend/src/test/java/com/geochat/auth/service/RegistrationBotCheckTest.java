package com.geochat.auth.service;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.assertj.core.api.Assertions.*;

class RegistrationBotCheckTest {
    private final RestClient.Builder builder = RestClient.builder().baseUrl("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private RegistrationBotCheck check() { return new RegistrationBotCheck(true,"production-site-key","valid-private-key","localhost",builder.build()); }

    @Test void optionalDisabledDoesNotCallProviderAndEnabledMissingConfigurationFails() {
        new RegistrationBotCheck(false,"","","",builder.build()).verify(null,"127.0.0.1");
        assertThatThrownBy(() -> new RegistrationBotCheck(true,"","","",builder.build())).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new RegistrationBotCheck(true,"1x00000000000000000000AA","valid-private-key","localhost",builder.build())).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> check().verify(null,"127.0.0.1")).isInstanceOf(IllegalArgumentException.class);
        server.verify();
    }

    @Test void validatesSuccessActionHostnameAndRejectsProviderFailuresAndReplays() {
        var check = check();
        for (String body: new String[]{"{\"success\":true,\"hostname\":\"localhost\",\"action\":\"register\",\"challenge_ts\":\"2026-10-18T00:00:00Z\",\"error-codes\":[]}",
                "{\"success\":false,\"error-codes\":[\"timeout-or-duplicate\"]}",
                "{\"success\":true,\"hostname\":\"attacker.example\",\"action\":\"register\"}",
                "{\"success\":true,\"hostname\":\"localhost\",\"action\":\"login\"}"}) {
            server.reset();
            server.expect(requestTo("https://challenges.cloudflare.com/turnstile/v0/siteverify"))
                    .andExpect(content().string(org.hamcrest.Matchers.containsString("remoteip=127.0.0.1")))
                    .andRespond(withSuccess(body,MediaType.APPLICATION_JSON));
            if (body.contains("\"success\":true,\"hostname\":\"localhost\",\"action\":\"register\""))
                assertThatCode(() -> check.verify("one-use-token","127.0.0.1")).doesNotThrowAnyException();
            else assertThatThrownBy(() -> check.verify("one-use-token","127.0.0.1")).isInstanceOf(IllegalArgumentException.class);
            server.verify();
        }
        server.reset();
        server.expect(anything()).andRespond(withServerError());
        assertThatThrownBy(() -> check.verify("token","127.0.0.1")).hasMessageContaining("verification failed");
        server.verify();
    }
}
