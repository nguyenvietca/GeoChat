# GeoChat Backend

This is the backend skeleton for the GeoChat modular monolith.

## Stack

- Java 21
- Spring Boot 4.1.x
- PostgreSQL + PostGIS
- Spring Security + JWT
- Spring WebSocket
- Flyway migrations

## Run locally

```bash
./mvnw spring-boot:run
```

## Push notifications

Expo push delivery is disabled by default. Set `PUSH_NOTIFICATIONS_ENABLED=true` to enable it and configure `EXPO_ACCESS_TOKEN` when required by the Expo project. Keep provider credentials in environment configuration; do not commit them.

## Notes

This is a skeleton only. Business logic and domain features will be added in later phases.
