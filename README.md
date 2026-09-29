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

Copy .env.example to .env and fill in values as needed.
