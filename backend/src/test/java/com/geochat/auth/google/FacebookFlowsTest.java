package com.geochat.auth.google;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import static org.assertj.core.api.Assertions.*;

class FacebookFlowsTest {
    final GoogleSettings shared = new GoogleSettings(false,"","",
            "http://localhost:8081/api/login/oauth2/code/google","http://localhost:8081");
    @Test void providerBindingExpiryAndOneTimeCompletion() {
        var time = new GoogleFlowsTest.Time(); var flows = new GoogleFlows(shared,time);
        var request = new MockHttpServletRequest();var response = new MockHttpServletResponse();
        flows.beginProvider(request,response,null,null,"LOGIN","facebook");
        request.setCookies(new GoogleFlowsTest().cookie(response));
        var facebook = OAuth2AuthorizationRequest.authorizationCode().authorizationUri("https://www.facebook.com/auth")
                .clientId("123456789").redirectUri("http://localhost:8081/api/login/oauth2/code/facebook")
                .state("state").attributes(a->a.put("registration_id","facebook")).build();
        assertThatThrownBy(()->flows.saveAuthorizationRequest(OAuth2AuthorizationRequest.from(facebook)
                .attributes(a->a.put("registration_id","google")).build(),request,response))
                .isInstanceOf(org.springframework.security.oauth2.core.OAuth2AuthenticationException.class);
        flows.saveAuthorizationRequest(facebook,request,response);
        request.setParameter("state","wrong");assertThat(flows.removeAuthorizationRequest(request,response)).isNull();
        request.setParameter("state","state");assertThat(flows.removeAuthorizationRequest(request,response)).isNotNull();
        assertThat(flows.removeAuthorizationRequest(request,response)).isNull();
        flows.complete(request,response,new GoogleAccounts.Claims("FACEBOOK","id",null,false,"Name"));
        request.setCookies(new GoogleFlowsTest().cookie(response));
        assertThat(flows.redeem(request,response,null).claims.provider()).isEqualTo("FACEBOOK");
        assertThatThrownBy(()->flows.redeem(request,response,null)).isInstanceOf(IllegalArgumentException.class);
        var secondResponse = new MockHttpServletResponse();
        flows.beginProvider(request,secondResponse,null,null,"LOGIN","facebook");
        request.setCookies(new GoogleFlowsTest().cookie(secondResponse));
        flows.saveAuthorizationRequest(facebook,request,secondResponse);time.now=time.now.plusSeconds(301);
        assertThat(flows.removeAuthorizationRequest(request,secondResponse)).isNull();
    }
    @Test void optionalConfigurationAndSecureCookiesWithoutGoogle() {
        assertThat(new FacebookSettings(false,"","","","",shared).enabled).isFalse();
        assertThatThrownBy(()->new FacebookSettings(true,"","","","",shared)).isInstanceOf(IllegalStateException.class);
        var https = new GoogleSettings(false,"","",shared.redirectUri,"https://app.geochat.invalid");
        var facebook = new FacebookSettings(true,"123456789","0123456789abcdef0123456789abcdef",
                "https://app.geochat.invalid/api/login/oauth2/code/facebook","v25.0",https);
        assertThat(facebook.enabled).isTrue();
        var registrations = new GoogleOAuthConfig().googleRegistrations(https, facebook);
        assertThat(registrations.findByRegistrationId("google")).isNull();
        assertThat(registrations.findByRegistrationId("facebook")).isNotNull();
        var response = new MockHttpServletResponse();new GoogleFlows(https).beginProvider(new MockHttpServletRequest(),response,null,null,"LOGIN","facebook");
        assertThat(response.getHeader("Set-Cookie")).contains("__Host-", "Secure", "HttpOnly", "SameSite=Lax");
        assertThatThrownBy(()->new FacebookSettings(true,"123456789","0123456789abcdef0123456789abcdef",
                "https://other.invalid/api/login/oauth2/code/facebook","v25.0",https)).isInstanceOf(IllegalStateException.class);
    }
}
