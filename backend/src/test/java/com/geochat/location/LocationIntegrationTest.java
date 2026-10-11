package com.geochat.location;

import com.geochat.auth.security.JwtService;
import com.geochat.location.entity.UserLocation;
import com.geochat.location.repository.UserLocationRepository;
import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;
import com.geochat.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.util.List;

import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.lessThan;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class LocationIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserLocationRepository locationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(webApplicationContext.getBean(FilterChainProxy.class))
                .build();
        locationRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void createsAndUpdatesCurrentLocation() throws Exception {
        User user = createUser("location-owner");
        String token = tokenFor(user);

        mockMvc.perform(post("/api/v1/locations/me")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"latitude":10.7769,"longitude":106.7009}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.latitude").value(10.7769))
                .andExpect(jsonPath("$.data.longitude").value(106.7009))
                .andExpect(jsonPath("$.data.updatedAt").isNotEmpty());

        mockMvc.perform(post("/api/v1/locations/me")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"latitude":-90,"longitude":180}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.latitude").value(-90))
                .andExpect(jsonPath("$.data.longitude").value(180));

        mockMvc.perform(get("/api/v1/locations/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.latitude").value(-90))
                .andExpect(jsonPath("$.data.longitude").value(180));

        org.junit.jupiter.api.Assertions.assertEquals(1, locationRepository.count());
    }

    @Test
    void rejectsOutOfRangeAndNullCoordinates() throws Exception {
        User user = createUser("location-validation");
        String token = tokenFor(user);

        assertInvalidLocation(token, "{\"latitude\":-90.01,\"longitude\":0}");
        assertInvalidLocation(token, "{\"latitude\":90.01,\"longitude\":0}");
        assertInvalidLocation(token, "{\"latitude\":0,\"longitude\":-180.01}");
        assertInvalidLocation(token, "{\"latitude\":0,\"longitude\":180.01}");
        assertInvalidLocation(token, "{\"latitude\":null,\"longitude\":0}");
        assertInvalidLocation(token, "{\"latitude\":0,\"longitude\":null}");

        org.junit.jupiter.api.Assertions.assertEquals(0, locationRepository.count());
    }

    @Test
    void userCanOnlyReadTheirOwnLocation() throws Exception {
        User firstUser = createUser("location-first");
        User secondUser = createUser("location-second");
        String firstToken = tokenFor(firstUser);
        String secondToken = tokenFor(secondUser);

        mockMvc.perform(post("/api/v1/locations/me")
                        .header("Authorization", bearer(firstToken))
                        .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"latitude":1.5,"longitude":2.5,"userId":%d}
                    """.formatted(secondUser.getId())))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/locations/me").header("Authorization", bearer(secondToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/locations/me")
                        .header("Authorization", bearer(firstToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.latitude").value(1.5))
                .andExpect(jsonPath("$.data.longitude").value(2.5));
    }

    @Test
    void locationEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/locations/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"latitude":1,"longitude":2}
                                """))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/locations/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void userWithoutLocationGetsNotFound() throws Exception {
        User user = createUser("location-empty");

        mockMvc.perform(get("/api/v1/locations/me")
                        .header("Authorization", bearer(tokenFor(user))))
                .andExpect(status().isNotFound());
    }

    @Test
    void findsNearbyUsersWithinRadiusAndExcludesCurrentUser() throws Exception {
        User currentUser = createUser("nearby-owner");
        User nearbyUser = createUser("nearby-user-1");
        nearbyUser.setNearbyDiscoverable(true); userRepository.save(nearbyUser);
        User farUser = createUser("nearby-user-2");
        String token = tokenFor(currentUser);

        locationRepository.saveAll(List.of(
                buildLocation(currentUser.getId(), 0.0, 0.0),
                buildLocation(nearbyUser.getId(), 0.01, 0.0),
                buildLocation(farUser.getId(), 0.2, 0.0)
        ));

        mockMvc.perform(get("/api/v1/locations/nearby")
                        .header("Authorization", bearer(token))
                        .param("radius", "5000")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.radiusMeters").value(5000))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].userId").value(nearbyUser.getId()))
                .andExpect(jsonPath("$.data.items[0].displayName").value(nearbyUser.getDisplayName()))
                .andExpect(jsonPath("$.data.items[0].distanceMeters").value(org.hamcrest.Matchers.greaterThanOrEqualTo(0.0)))
                .andExpect(jsonPath("$.data.items[0].distanceMeters").value(lessThan(5000.0)))
                .andExpect(jsonPath("$.data.items[0].latitude").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].longitude").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].passwordHash").doesNotExist());
    }

    @Test
    void rejectsInvalidRadius() throws Exception {
        User user = createUser("nearby-invalid");
        String token = tokenFor(user);
        locationRepository.save(buildLocation(user.getId(), 0.0, 0.0));

        mockMvc.perform(get("/api/v1/locations/nearby")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/locations/nearby")
                        .header("Authorization", bearer(token))
                        .param("radius", "0"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/locations/nearby")
                        .header("Authorization", bearer(token))
                        .param("radius", "-1"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/locations/nearby")
                        .header("Authorization", bearer(token))
                        .param("radius", "100001"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/locations/nearby")
                        .header("Authorization", bearer(token))
                        .param("radius", "abc"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void currentUserWithoutLocationGetsNotFoundForNearbySearch() throws Exception {
        User user = createUser("nearby-empty");

        mockMvc.perform(get("/api/v1/locations/nearby")
                        .header("Authorization", bearer(tokenFor(user)))
                        .param("radius", "5000"))
                .andExpect(status().isNotFound());
    }

    private UserLocation buildLocation(Long userId, Double latitude, Double longitude) {
        UserLocation location = new UserLocation();
        location.setUserId(userId);
        location.setLatitude(latitude);
        location.setLongitude(longitude);
        location.setUpdatedAt(Instant.now());
        return location;
    }

    private void assertInvalidLocation(String token, String requestBody) throws Exception {
        mockMvc.perform(post("/api/v1/locations/me")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Autowired private com.geochat.location.service.LocationService locations;
    @Test void optInFreshnessAndStableCoarseAreasProtectLocation() {
        var viewer=createUser("privacy-viewer");var target=createUser("privacy-target");
        var point=buildLocation(target.getId(),0.01,0.01);
        locationRepository.saveAll(List.of(buildLocation(viewer.getId(),0.01,0.01),point));
        org.assertj.core.api.Assertions.assertThat(locations.discoverability(target.getUsername()).discoverable()).isFalse();
        org.assertj.core.api.Assertions.assertThat(locations.getNearbyUsers(viewer.getUsername(),1000.0,20).items()).isEmpty();
        locations.setDiscoverability(target.getUsername(),true);
        var first=locations.getNearbyUsers(viewer.getUsername(),1000.0,20).items().getFirst();
        org.assertj.core.api.Assertions.assertThat(first.mapArea().centerLatitude()).isEqualTo(0.025);
        point.setLatitude(0.049);point.setLongitude(0.041);locationRepository.save(point);
        org.assertj.core.api.Assertions.assertThat(locations.getNearbyUsers(viewer.getUsername(),1000.0,20).items().getFirst()).isEqualTo(first);
        point.setUpdatedAt(Instant.now().minusSeconds(90000));locationRepository.save(point);
        org.assertj.core.api.Assertions.assertThat(locations.getNearbyUsers(viewer.getUsername(),1000.0,20).items()).isEmpty();
        point.setUpdatedAt(Instant.now());locationRepository.save(point);target.setStatus(UserStatus.INACTIVE);userRepository.save(target);
        org.assertj.core.api.Assertions.assertThat(locations.getNearbyUsers(viewer.getUsername(),1000.0,20).items()).isEmpty();
        locations.setDiscoverability(target.getUsername(),false);
        org.assertj.core.api.Assertions.assertThat(locations.discoverability(target.getUsername()).discoverable()).isFalse();
    }
    @Test void privacySettingRequiresJwtAndPublicProfileHasOnlyPermittedFields() throws Exception {
        var user=createUser("visibility-account");
        var request=org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/locations/discoverability").contentType(MediaType.APPLICATION_JSON).content("{\"discoverable\":true}");
        mockMvc.perform(request).andExpect(status().isUnauthorized());
        mockMvc.perform(request.header("Authorization",bearer(tokenFor(user)))).andExpect(status().isOk()).andExpect(jsonPath("$.data.discoverable").value(true));
        mockMvc.perform(get("/api/v1/users/"+user.getId()+"/profile").header("Authorization",bearer(tokenFor(user)))).andExpect(status().isOk()).andExpect(jsonPath("$.data.displayName").value(user.getDisplayName())).andExpect(jsonPath("$.data.passwordHash").doesNotExist()).andExpect(jsonPath("$.data.latitude").doesNotExist());
    }
    @Test void paginationIsBoundedAndAbuseGuardRejectsExcessRequests() {
        var viewer=createUser("paged-viewer");locationRepository.save(buildLocation(viewer.getId(),0.01,0.01));
        for(int i=0;i<5;i++){var user=createUser("paged-"+i);locations.setDiscoverability(user.getUsername(),true);locationRepository.save(buildLocation(user.getId(),0.01,0.01));}
        var first=locations.getNearbyUsers(viewer.getUsername(),5000.0,2,0);var second=locations.getNearbyUsers(viewer.getUsername(),5000.0,2,1);
        org.assertj.core.api.Assertions.assertThat(first.items()).hasSize(2);org.assertj.core.api.Assertions.assertThat(first.hasMore()).isTrue();
        org.assertj.core.api.Assertions.assertThat(second.items()).hasSize(2);org.assertj.core.api.Assertions.assertThat(first.items()).doesNotContainAnyElementsOf(second.items());
        org.assertj.core.api.Assertions.assertThatThrownBy(()->locations.getNearbyUsers(viewer.getUsername(),Double.NaN,2)).isInstanceOf(IllegalArgumentException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(()->locations.getNearbyUsers(viewer.getUsername(),5000.0,2,5)).isInstanceOf(IllegalArgumentException.class);
        var guard=new com.geochat.location.service.NearbyRequestGuard();for(int i=0;i<20;i++)guard.check("user",20);
        org.assertj.core.api.Assertions.assertThatThrownBy(()->guard.check("user",20)).isInstanceOf(com.geochat.location.service.NearbyRequestGuard.RateLimitException.class);
    }

    private User createUser(String username) {
        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode("LocationTest123!"));
        user.setDisplayName(username);
        user.setStatus(UserStatus.ACTIVE);
        user.setCreatedAt(Instant.now());
        user.setUpdatedAt(Instant.now());
        return userRepository.save(user);
    }

    private String tokenFor(User user) {
        return jwtService.generateToken(user.getId(), user.getUsername());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}