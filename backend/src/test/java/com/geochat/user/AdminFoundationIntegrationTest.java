package com.geochat.user;

import com.geochat.auth.security.JwtService;
import com.geochat.user.entity.*;
import com.geochat.user.repository.UserRepository;
import com.geochat.user.service.*;
import com.geochat.auth.google.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @ActiveProfiles("test")
class AdminFoundationIntegrationTest {
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtService jwt;
    @Autowired WebApplicationContext context;
    @Autowired AccountLifecycleService lifecycle;
    @Autowired AdminProvisioning provisioning;
    @Autowired GoogleAccounts providers;
    @Autowired GoogleIdentityRepository identities;
    MockMvc mvc; User admin,alice;String adminToken,aliceToken;
    @BeforeEach void setup() {
        identities.deleteAll();users.deleteAll();jdbc.update("DELETE FROM account_actions");
        admin=user("operator",UserRole.ADMIN);alice=user("alice",UserRole.USER);
        adminToken=token(admin);aliceToken=token(alice);
        mvc=MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
    }
    @AfterEach void cleanup(){identities.deleteAll();users.deleteAll();jdbc.update("DELETE FROM account_actions");}
    User user(String name,UserRole role) {var u=new User();u.setUsername(name);u.setDisplayName(name);u.setRole(role);u.setEmail(name+"@example.com");u.setPasswordHash(passwords.encode("Password123!"));return users.saveAndFlush(u);}
    String token(User user){return "Bearer "+jwt.generateToken(user.getId(),user.getUsername(),user.getAuthVersion());}
    @Test void authorizationEveryEndpointAndNoSecrets() throws Exception {
        for(String path:new String[]{"/users","/users/"+alice.getId(),"/audit-logs","/overview"}) {
            mvc.perform(get("/api/v1/admin"+path)).andExpect(status().isUnauthorized());
            mvc.perform(get("/api/v1/admin"+path).header("Authorization",aliceToken)).andExpect(status().isForbidden());
            String result=mvc.perform(get("/api/v1/admin"+path).header("Authorization",adminToken)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertThat(result).doesNotContain("passwordHash","password_hash","providerUserId","authVersion","latitude","longitude","access_token");
        }
        mvc.perform(get("/api/v1/admin/users/999999").header("Authorization",adminToken)).andExpect(status().isNotFound());
    }
    @Test void boundedParameterizedSearchFiltersAndProviders() throws Exception {
        providers.resolve(new GoogleAccounts.Claims("FACEBOOK","fb-user",null,false,"Alice"),alice.getId());
        mvc.perform(get("/api/v1/admin/users").header("Authorization",adminToken).param("query","ALICE@example.com").param("provider","FACEBOOK").param("status","ACTIVE").param("size","1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(1)).andExpect(jsonPath("$.data.items[0].providers[1]").value("FACEBOOK"));
        mvc.perform(get("/api/v1/admin/users").header("Authorization",adminToken).param("query","%' OR 1=1 --"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(0));
        for(String size:new String[]{"0","101","-1"})mvc.perform(get("/api/v1/admin/users").header("Authorization",adminToken).param("size",size)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users").header("Authorization",adminToken).param("status","INVALID")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users").header("Authorization",adminToken).param("page","-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users").header("Authorization",adminToken).param("size","1"))
                .andExpect(jsonPath("$.data.hasMore").value(true));
    }
    @Test void suspensionReactivationAuditAndStaleJwt() throws Exception {
        String endpoint="/api/v1/admin/users/"+alice.getId();
        mvc.perform(post(endpoint+"/suspend").header("Authorization",aliceToken).contentType("application/json").content("{\"reason\":\"Spam\"}")).andExpect(status().isForbidden());
        mvc.perform(post(endpoint+"/suspend").header("Authorization",adminToken).contentType("application/json").content("{\"reason\":\" \"}")).andExpect(status().isBadRequest());
        mvc.perform(post(endpoint+"/suspend").header("Authorization",adminToken).contentType("application/json").content("{\"reason\":\"Spam\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/me").header("Authorization",aliceToken)).andExpect(status().isUnauthorized());
        mvc.perform(post(endpoint+"/suspend").header("Authorization",adminToken).contentType("application/json").content("{\"reason\":\"Repeated\"}")).andExpect(status().isConflict());
        mvc.perform(post(endpoint+"/reactivate").header("Authorization",adminToken).contentType("application/json").content("{\"reason\":\"Appeal accepted\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/audit-logs").header("Authorization",adminToken).param("target",alice.getId().toString()).param("action","BLOCK"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].previousStatus").value("ACTIVE")).andExpect(jsonPath("$.data.items[0].newStatus").value("LOCKED"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_actions",Long.class)).isEqualTo(2);
        mvc.perform(get("/api/v1/users/me").header("Authorization",aliceToken)).andExpect(status().isUnauthorized());
        assertThat(users.findById(alice.getId())).isPresent();
    }
    @Test void operatorConfirmationIdempotencyRevocationAndFinalAdmin() throws Exception {
        assertThatThrownBy(()->provisioning.change(alice.getId(),"GRANT_ADMIN","wrong","Initial admin")).isInstanceOf(IllegalArgumentException.class);
        provisioning.change(alice.getId(),"GRANT_ADMIN","GRANT_ADMIN:"+alice.getId(),"Initial admin");
        provisioning.change(alice.getId(),"GRANT_ADMIN","GRANT_ADMIN:"+alice.getId(),"Repeated");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_actions",Long.class)).isEqualTo(1);
        provisioning.change(admin.getId(),"REVOKE_ADMIN","REVOKE_ADMIN:"+admin.getId(),"Compromised session");
        mvc.perform(get("/api/v1/admin/users").header("Authorization",adminToken)).andExpect(status().isUnauthorized());
        var freshAdmin=users.findById(admin.getId()).orElseThrow();
        mvc.perform(get("/api/v1/admin/users").header("Authorization",token(freshAdmin))).andExpect(status().isForbidden());
        assertThatThrownBy(()->provisioning.change(alice.getId(),"REVOKE_ADMIN","REVOKE_ADMIN:"+alice.getId(),"Final" )).isInstanceOf(IllegalArgumentException.class);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_actions WHERE actor_id=0",Long.class)).isEqualTo(2);
    }
    @Test void protectedAdminAndConcurrentModeration() throws Exception {
        assertThatThrownBy(()->lifecycle.moderate(admin.getUsername(),admin.getId(),true,"Self" )).isInstanceOf(IllegalArgumentException.class);
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {
            Callable<Boolean> task=()->{gate.await();try{lifecycle.moderate(admin.getUsername(),alice.getId(),true,"Concurrent");return true;}catch(com.geochat.user.exception.AccountStateConflict conflict){return false;}};
            var first=pool.submit(task);var second=pool.submit(task);gate.countDown();
            assertThat(first.get(15,TimeUnit.SECONDS)^second.get(15,TimeUnit.SECONDS)).isTrue();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM account_actions",Long.class)).isEqualTo(1);
        }finally{pool.shutdownNow();}
    }
    @Test void dedicatedNonWebOperatorEntryPointCanProvisionExistingIdentity() throws Exception {
        String url;
        try(var connection=jdbc.getDataSource().getConnection()){url=connection.getMetaData().getURL();}
        com.geochat.operator.AdminOperatorMain.main(new String[]{
                "--spring.profiles.active=test","--spring.config.import=","--spring.main.banner-mode=off",
                "--spring.datasource.url="+url+";MODE=PostgreSQL;DATABASE_TO_UPPER=false","--spring.datasource.driver-class-name=org.h2.Driver",
                "--spring.datasource.username=sa","--spring.datasource.password=", "--spring.flyway.enabled=false",
                "--spring.jpa.hibernate.ddl-auto=none","--app.admin-operator.enabled=true",
                "--app.admin-operator.user-id="+alice.getId(),"--app.admin-operator.action=GRANT_ADMIN",
                "--app.admin-operator.confirmation=GRANT_ADMIN:"+alice.getId(),"--app.admin-operator.reason=Operator entry point test"});
        assertThat(users.findById(alice.getId()).orElseThrow().getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_actions WHERE actor_id=0",Long.class)).isEqualTo(1);
    }
    @Test void concurrentRevocationsPreserveOneActiveAdministrator() throws Exception {
        provisioning.change(alice.getId(),"GRANT_ADMIN","GRANT_ADMIN:"+alice.getId(),"Second administrator");
        jdbc.update("DELETE FROM account_actions");
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {
            var attempts=java.util.List.of(admin.getId(),alice.getId()).stream().map(id->pool.submit(()->{
                gate.await();try { provisioning.change(id,"REVOKE_ADMIN","REVOKE_ADMIN:"+id,"Concurrent revocation");return true; }
                catch(IllegalArgumentException conflict){return false;}
            })).toList();
            gate.countDown();int successes=0;for(var result:attempts)if(result.get(15,TimeUnit.SECONDS))successes++;
            assertThat(successes).isEqualTo(1);assertThat(users.countActiveAdministrators()).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM account_actions",Long.class)).isEqualTo(1);
        } finally {pool.shutdownNow();}
    }
}
