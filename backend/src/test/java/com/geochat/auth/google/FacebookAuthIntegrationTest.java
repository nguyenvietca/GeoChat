package com.geochat.auth.google;

import com.geochat.auth.security.JwtService;
import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;
import com.geochat.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"facebook.enabled=true", "facebook.app-id=123456789",
        "facebook.app-secret=0123456789abcdef0123456789abcdef", "google.enabled=true",
        "google.client-id=test.apps.googleusercontent.com", "google.client-secret=synthetic-secret-only"})
@ActiveProfiles("test")
@Import(FacebookAuthIntegrationTest.Provider.class)
class FacebookAuthIntegrationTest {
    static final String ORIGIN = "http://localhost:8081";
    static final ObjectMapper JSON = new ObjectMapper();
    static HttpServer provider;
    static volatile String problem = "";
    static volatile boolean serverSecret, bearerProfile;
    static {
        try {
            provider = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            provider.createContext("/token", exchange -> {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                serverSecret = body.contains("client_secret=0123456789abcdef0123456789abcdef");
                byte[] response = (problem.equals("code") ? "{\"error\":\"invalid_grant\"}" :
                        "{\"access_token\":\"facebook-private-token\",\"token_type\":\"Bearer\",\"expires_in\":600}").getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(problem.equals("code") ? 400 : 200, response.length);
                exchange.getResponseBody().write(response); exchange.close();
            });
            provider.createContext("/debug_token", exchange -> {
                Map<String,Object> data = new HashMap<>(Map.of("is_valid", !problem.equals("invalid"),
                        "app_id", problem.equals("app") ? "wrong-app" : "123456789", "type", "USER",
                        "user_id", "fb-subject", "expires_at", Instant.now().plusSeconds(problem.equals("expired") ? -60 : 600).getEpochSecond(),
                        "scopes", problem.equals("scope") ? List.of() : List.of("public_profile")));
                if (problem.equals("data-expired")) data.put("data_access_expires_at", 1);
                byte[] response = problem.equals("malformed") ? "not-json".getBytes(StandardCharsets.UTF_8)
                        : JSON.writeValueAsBytes(Map.of("data", data));
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(problem.equals("debug") ? 500 : 200, response.length); exchange.getResponseBody().write(response); exchange.close();
            });
            provider.createContext("/me", exchange -> {
                bearerProfile = "Bearer facebook-private-token".equals(exchange.getRequestHeaders().getFirst("Authorization"));
                var data = new HashMap<String,Object>(Map.of("id", problem.equals("subject") ? "wrong-subject" : "fb-subject", "name", "Facebook Test"));
                if (!problem.equals("no-email")) data.put("email", "facebook@example.com");
                byte[] response = JSON.writeValueAsBytes(data);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(problem.equals("profile") ? 500 : 200, response.length);
                exchange.getResponseBody().write(response); exchange.close();
            });
            provider.start();
        } catch (Exception e) { throw new ExceptionInInitializerError(e); }
    }
    @TestConfiguration
    static class Provider {
        @Bean @Primary ClientRegistrationRepository mockedProviders(GoogleSettings google, FacebookSettings facebook) {
            String url = "http://127.0.0.1:" + provider.getAddress().getPort();
            var production = new GoogleOAuthConfig().googleRegistrations(google, facebook);
            return new InMemoryClientRegistrationRepository(production.findByRegistrationId("google"),
                    ClientRegistration.withClientRegistration(production.findByRegistrationId("facebook"))
                            .authorizationUri(url + "/authorize").tokenUri(url + "/token")
                            .userInfoUri(url + "/me?fields=id,name,email").build());
        }
    }
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired GoogleIdentityRepository identities;
    @Autowired GoogleAccounts accounts;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtService jwt;
    MockMvc mvc;
    @BeforeEach void setup() {
        identities.deleteAll(); users.deleteAll(); problem=""; serverSecret=false; bearerProfile=false;
        mvc=MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
    }
    @AfterEach void cleanup() { identities.deleteAll(); users.deleteAll(); }
    @AfterAll static void stop() { provider.stop(0); }
    Cookie cookie(MvcResult result) {
        String header = result.getResponse().getHeaders("Set-Cookie").getLast();
        return new Cookie(GoogleFlows.COOKIE, header.split(";",2)[0].split("=",2)[1]);
    }
    record Started(Cookie cookie, String state) {}
    Started start(String token) throws Exception { return startAction("start", token); }
    Started startAction(String action, String token) throws Exception {
        return startAction(action, token, "unlink");
    }
    Started startAction(String action, String token, String proofAction) throws Exception {
        var request=post("/api/v1/auth/facebook/"+action).header("Origin",ORIGIN).contentType("application/json")
                .content(action.equals("reauth") ? "{\"action\":\"" + proofAction + "\"}" : "{\"password\":\"Password123!\"}");
        if(token!=null) request.header("Authorization","Bearer "+token);
        var begun=mvc.perform(request).andExpect(status().isOk()).andReturn();
        var auth=mvc.perform(get("/api/oauth2/authorization/facebook").cookie(cookie(begun))).andExpect(status().is3xxRedirection()).andReturn();
        String query=URI.create(auth.getResponse().getRedirectedUrl()).getRawQuery();
        assertThat(query).contains("public_profile", "email").doesNotContain("client_secret", "code_challenge", "openid");
        String state=Arrays.stream(query.split("&")).filter(p->p.startsWith("state=")).findFirst().orElseThrow().substring(6);
        return new Started(cookie(begun),URLDecoder.decode(state,StandardCharsets.UTF_8));
    }
    MvcResult callback(Started started) throws Exception {
        return mvc.perform(get("/api/login/oauth2/code/facebook").cookie(started.cookie()).param("state",started.state())
                .param("code","synthetic-facebook-code")).andExpect(status().is3xxRedirection()).andReturn();
    }
    MvcResult complete(MvcResult callback,String token) throws Exception {
        var request=post("/api/v1/auth/facebook/complete").header("Origin",ORIGIN).cookie(cookie(callback));
        if(token!=null) request.header("Authorization","Bearer "+token);
        return mvc.perform(request).andReturn();
    }
    User passwordUser(String name) {
        User u=new User();u.setUsername(name);u.setDisplayName(name);u.setPasswordHash(passwords.encode("Password123!"));return users.saveAndFlush(u);
    }
    GoogleAccounts.Claims claims(String sub, String email) {return new GoogleAccounts.Claims("FACEBOOK",sub,email,false,"Facebook");}
    @Test void firstReturningNoEmailJwtAndReplay() throws Exception {
        problem="no-email";
        var started=start(null);var returned=callback(started);
        assertThat(returned.getResponse().getRedirectedUrl()).isEqualTo(ORIGIN+"/oauth/complete?provider=facebook");
        assertThat(serverSecret).isTrue();assertThat(bearerProfile).isTrue();
        var result=complete(returned,null);assertThat(result.getResponse().getStatus()).isEqualTo(200);
        String token=JSON.readTree(result.getResponse().getContentAsString()).path("data").path("token").asText();
        assertThat(jwt.isTokenValid(token)).isTrue();Long id=jwt.getUserId(token);
        assertThat(users.findById(id).orElseThrow().getEmail()).isNull();
        assertThat(identities.findAll().getFirst().email).isNull();
        assertThat(complete(returned,null).getResponse().getStatus()).isEqualTo(400);
        assertThat(callback(started).getResponse().getRedirectedUrl()).contains("error=failed");
        var returning=complete(callback(start(null)),null);
        assertThat(jwt.getUserId(JSON.readTree(returning.getResponse().getContentAsString()).path("data").path("token").asText())).isEqualTo(id);
        assertThat(users.count()).isEqualTo(1);assertThat(identities.count()).isEqualTo(1);
        assertThat(result.getResponse().getContentAsString()).doesNotContain("facebook-private-token","synthetic-facebook-code","app-secret");
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+token)).andExpect(status().isOk());
    }
    @ParameterizedTest @ValueSource(strings={"code","invalid","app","expired","scope","data-expired","subject","profile","debug","malformed"})
    void invalidProviderNeverCreatesUser(String invalid) throws Exception {
        problem=invalid;
        assertThat(callback(start(null)).getResponse().getRedirectedUrl()).contains("error=failed");
        assertThat(users.count()).isZero();assertThat(identities.count()).isZero();
    }
    @Test void collisionDoesNotMergeAndUnverifiedEmailIsNotRecoveryAddress() throws Exception {
        var existing=passwordUser("existing");existing.setEmail("facebook@example.com");users.saveAndFlush(existing);
        assertThat(complete(callback(start(null)),null).getResponse().getStatus()).isEqualTo(400);
        assertThat(users.count()).isEqualTo(1);assertThat(identities.count()).isZero();
        var created=accounts.resolve(claims("other","other@example.com"),null);
        assertThat(created.getEmail()).isNull();
    }
    @Test void explicitLinkSessionBindingAndPasswordUnlink() throws Exception {
        User user=passwordUser("owner");String token=jwt.generateToken(user.getId(),user.getUsername());
        mvc.perform(post("/api/v1/auth/facebook/link").header("Origin",ORIGIN).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        var returned=callback(startAction("link",token));assertThat(complete(returned,null).getResponse().getStatus()).isEqualTo(401);
        returned=callback(startAction("link",token));assertThat(complete(returned,token).getResponse().getStatus()).isEqualTo(200);
        assertThat(identities.findAll().getFirst().userId).isEqualTo(user.getId());
        mvc.perform(get("/api/v1/auth/facebook/connections").header("Authorization","Bearer "+token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facebookConnected").value(true)).andExpect(jsonPath("$.data.subject").doesNotExist());
        mvc.perform(post("/api/v1/auth/facebook/unlink").header("Origin",ORIGIN).header("Authorization","Bearer "+token)
                .contentType("application/json").content("{\"password\":\"Password123!\"}")).andExpect(status().isOk());
        assertThat(users.findById(user.getId())).isPresent();assertThat(identities.count()).isZero();
    }
    @Test void coexistenceCannotTransferAndFinalMethodProtected() {
        User google=accounts.resolve(new GoogleAccounts.Claims("google","google@example.com",true,"Google"),null);
        accounts.resolve(claims("fb-subject",null),google.getId());
        assertThat(identities.count()).isEqualTo(2);
        User other=passwordUser("other");
        assertThatThrownBy(()->accounts.resolve(claims("fb-subject",null),other.getId())).isInstanceOf(IllegalArgumentException.class);
        accounts.unlinkVerified(google.getId(),"FACEBOOK");assertThat(identities.count()).isEqualTo(1);
        assertThatThrownBy(()->accounts.unlinkVerified(google.getId(),"GOOGLE")).isInstanceOf(IllegalArgumentException.class);
        assertThat(users.findById(google.getId())).isPresent();
    }
    @Test void providerReauthenticationAllowsUnlinkWithAnotherProvider() throws Exception {
        User user=accounts.resolve(claims("fb-subject",null),null);
        accounts.resolve(new GoogleAccounts.Claims("google","google@example.com",true,"Google"),user.getId());
        String token=jwt.generateToken(user.getId(),user.getUsername());
        assertThat(complete(callback(startAction("reauth",token)),token).getResponse().getStatus()).isEqualTo(200);
        assertThat(identities.findByUserIdAndProvider(user.getId(),"GOOGLE")).isEmpty();
        assertThat(identities.findByUserIdAndProvider(user.getId(),"FACEBOOK")).isPresent();
    }
    @Test void lockedUserStateAndCancellationRejected() throws Exception {
        var user=accounts.resolve(claims("fb-subject",null),null);user.setStatus(UserStatus.LOCKED);users.saveAndFlush(user);
        assertThat(complete(callback(start(null)),null).getResponse().getStatus()).isEqualTo(403);
        var started=start(null);
        mvc.perform(get("/api/login/oauth2/code/facebook").cookie(started.cookie()).param("state","wrong").param("code","code"))
                .andExpect(redirectedUrl(ORIGIN+"/oauth/complete?error=failed"));
        started=start(null);
        mvc.perform(get("/api/login/oauth2/code/facebook").cookie(started.cookie()).param("state",started.state()).param("error","access_denied"))
                .andExpect(redirectedUrl(ORIGIN+"/oauth/complete?error=cancelled"));
    }
    @Test void simultaneousFirstLoginIsAtomic() throws Exception {
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {
            Callable<Long> task=()->{gate.await();return accounts.resolve(claims("race",null),null).getId();};
            var first=pool.submit(task);var second=pool.submit(task);gate.countDown();
            assertThat(first.get(15,TimeUnit.SECONDS)).isEqualTo(second.get(15,TimeUnit.SECONDS));
            assertThat(users.count()).isEqualTo(1);assertThat(identities.count()).isEqualTo(1);
        } finally {pool.shutdownNow();}
    }
    @Test void providerProofStartsSecondFlowWithoutPrematureLink() throws Exception {
        User user=accounts.resolve(claims("fb-subject",null),null);
        String token=jwt.generateToken(user.getId(),user.getUsername());
        var verified=complete(callback(startAction("reauth",token,"link")),token);
        assertThat(verified.getResponse().getStatus()).isEqualTo(200);
        assertThat(JSON.readTree(verified.getResponse().getContentAsString()).path("data").path("nextUrl").asText())
                .isEqualTo("/api/oauth2/authorization/google");
        assertThat(identities.count()).isEqualTo(1);
        mvc.perform(get("/api/oauth2/authorization/google").cookie(cookie(verified))).andExpect(status().is3xxRedirection());
    }
    @Test void proofFromUnconnectedIdentityCannotUnlinkOrLink() throws Exception {
        User user=passwordUser("proof-owner");
        accounts.resolve(claims("another-subject",null),user.getId());
        String token=jwt.generateToken(user.getId(),user.getUsername());
        assertThat(complete(callback(startAction("reauth",token,"link")),token).getResponse().getStatus()).isEqualTo(401);
        assertThat(identities.count()).isEqualTo(1);
    }
    @Test void concurrentUnlinksCannotRemoveBothProviders() throws Exception {
        User user=accounts.resolve(claims("fb-subject",null),null);
        accounts.resolve(new GoogleAccounts.Claims("google","google@example.com",true,"Google"),user.getId());
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {
            var attempts=List.of("GOOGLE","FACEBOOK").stream().map(p->pool.submit(()->{
                gate.await();try {accounts.unlinkVerified(user.getId(),p);return true;}
                catch(IllegalArgumentException e){return false;}
            })).toList();
            gate.countDown();int successes=0;
            for(var attempt:attempts) if(attempt.get(15,TimeUnit.SECONDS)) successes++;
            assertThat(successes).isEqualTo(1);assertThat(identities.count()).isEqualTo(1);
            assertThat(users.findById(user.getId())).isPresent();
        } finally {pool.shutdownNow();}
    }
    @Test void revokedSessionCannotMutateIdentityAfterTakingUserLock() {
        User user=passwordUser("revoked");
        accounts.resolve(claims("fb-subject",null),user.getId());
        assertThatThrownBy(()->accounts.resolve(claims("new-subject",null),user.getId(),user.getAuthVersion()+1))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(()->accounts.unlinkVerified(user.getId(),"FACEBOOK",user.getAuthVersion()+1))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(identities.count()).isEqualTo(1);
    }
}
