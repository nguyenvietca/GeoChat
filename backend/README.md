# GeoChat Backend

GeoChat's Spring Boot API for authentication, profiles, location search, friends, direct chat, notifications, and push-device registration.

## Stack

- Java 21
- Spring Boot 4.1.x
- PostgreSQL + PostGIS
- Spring Security + JWT
- Spring WebSocket
- Flyway migrations

## Run Locally

Use Java 21 and start PostgreSQL/PostGIS from the repository root with `docker compose up -d postgres`. Copy the root `.env.example` to `.env` and replace its local database password and JWT secret. Spring Boot does not load `.env` itself, so provide `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, and `JWT_SECRET` in the process or IDE run configuration.

On Windows PowerShell:

```powershell
.\mvnw.cmd spring-boot:run
```

On macOS/Linux:

```bash
./mvnw spring-boot:run
```

Run backend tests with `.\mvnw.cmd test` on Windows or `./mvnw test` on macOS/Linux. The test profile uses in-memory H2; local development uses PostgreSQL/PostGIS and applies Flyway migrations at startup.

## Push notifications

Expo push delivery is disabled by default. Set `PUSH_NOTIFICATIONS_ENABLED=true` to enable it and configure `EXPO_ACCESS_TOKEN` when required by the Expo project. Keep provider credentials in environment configuration; do not commit them.

The unauthenticated health endpoint is `GET /api/health`. Production secrets and CORS origins must come from deployment configuration; do not use example values outside local development.
