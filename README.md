# GeoChat

GeoChat is a cross-platform location-based social chat application built with a shared Spring Boot backend, React web frontend, and React Native mobile app.

## Repository structure

- apps/web: Vite + React + TypeScript web client
- apps/mobile: Expo + React Native mobile app
- backend: Spring Boot + Java 21 API and business logic
- packages: shared types, API contracts, validation helpers, constants
- database: schema migrations and seed scripts
- docs: product and technical documentation

## Prerequisites

- Java 21
- Node.js 22.12 or newer
- Docker Compose, for the local PostgreSQL/PostGIS database

## Getting started

1. Start the backend:
   - cd backend
   - ./mvnw spring-boot:run
2. Start the web app:
   - cd apps/web
   - npm install
   - npm run dev
3. Start the mobile app:
   - cd apps/mobile
   - npm install
   - npx expo start


## Local Development

1. From the repository root, copy `.env.example` to `.env`. Set a local database password and a unique random `JWT_SECRET` of at least 32 UTF-8 bytes. Quote values containing `$` with single quotes so Compose does not interpret them. This root file configures Docker Compose; Spring Boot does not load it automatically.
2. Start PostgreSQL/PostGIS with `docker compose up -d postgres`. The database is exposed on port 5432 and its data persists in a Docker volume.
3. Start the backend from `backend`. Supply `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, and `JWT_SECRET` to the process or IDE run configuration, then run `./mvnw spring-boot:run` (Windows: `.\mvnw.cmd spring-boot:run`). Flyway applies migrations at startup. The health endpoint is `http://localhost:8080/api/health`.
4. Start the web app from `apps/web`: copy `.env.example` to `.env`, run `npm install`, then `npm run dev`. Set `VITE_API_BASE_URL` there if the backend is not at `http://localhost:8080`.
5. Start the mobile app from `apps/mobile`: copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_BASE_URL` for the target device, run `npm install`, then `npx expo start`. Android emulators use `http://10.0.2.2:8080`; iOS simulators use `http://localhost:8080`; physical devices need the computer's reachable LAN address. Expo push setup additionally requires an EAS project ID and provider credentials.

Stop the local database with `docker compose stop postgres`; this keeps its volume and data.

## Validation

From `backend`, run `./mvnw test` (Windows: `.\mvnw.cmd test`). In `apps/web`, run `npm run build` and `npm test`. In `apps/mobile`, run `npm run typecheck` and `npm test -- --runInBand`.

Never commit `.env` files or use the documented example values outside local development. Web and mobile use separate environment files in their respective app directories.
