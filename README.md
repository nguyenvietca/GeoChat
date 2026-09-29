# GeoChat

GeoChat is a cross-platform location-based social chat application built with a shared Spring Boot backend, React web frontend, and React Native mobile app.

## Repository structure

- apps/web: Vite + React + TypeScript web client
- apps/mobile: Expo + React Native mobile app
- backend: Spring Boot + Java 21 API and business logic
- packages: shared types, API contracts, validation helpers, constants
- database: schema migrations and seed scripts
- docs: product and technical documentation

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

## Environment

Copy `.env.example` to `.env` and replace every `replace-with-...` value. Docker Compose reads `.env` automatically.

Spring Boot does not load `.env` automatically. When running the backend from a terminal or Spring Tool Suite, set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, and `JWT_SECRET` in the process environment or the run configuration. `JWT_SECRET` must contain at least 32 UTF-8 bytes. Never commit `.env` or use the example values outside local development.
