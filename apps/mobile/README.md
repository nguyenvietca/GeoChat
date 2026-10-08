# GeoChat Mobile

This Expo app is the mobile foundation for GeoChat. It includes centralized API configuration, a reusable HTTP client, secure token storage, and a simple authenticated flow for login/register/logout.

## Start

```bash
npm install
npx expo start
```

Use Node.js 22.12 or newer. For local configuration, copy `.env.example` to `.env` in `apps/mobile` and set `EXPO_PUBLIC_API_BASE_URL` for the target device. Expo reads app environment files from this directory, not the repository root.

## Local backend configuration

The mobile app expects the backend to be running on port 8080.

By default, the app uses:

- Android emulator: http://10.0.2.2:8080
- iOS simulator: http://localhost:8080
- Expo web on the development machine: http://localhost:8080
- Physical device: set `EXPO_PUBLIC_API_BASE_URL` to the development machine's LAN IP

For a physical device, set the URL to the development machine's LAN IP and make sure the device and machine can reach each other. For example:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:8080 npx expo start
```

The backend must be reachable on port 8080. The repository Compose setup starts only the PostgreSQL/PostGIS database; start the backend separately.

## Push notifications

Expo push token registration requires an EAS project ID. Set `EXPO_PUBLIC_EAS_PROJECT_ID` to the project UUID, or link the app to an EAS project so Expo Constants can provide it. Push registration is skipped safely when no project ID is available. Test delivery on a physical iOS or Android device with push credentials configured for the EAS project.

On the backend, push delivery is disabled by default. Set `PUSH_NOTIFICATIONS_ENABLED=true` to enable Expo delivery; set `EXPO_ACCESS_TOKEN` when the Expo project requires an access token. The app registers its device after authentication and deactivates that device on logout.

## Authentication flow

The app uses the existing backend endpoints:


On iOS and Android, tokens are stored with `expo-secure-store`. Expo web uses `localStorage` because the native secure store is unavailable there; browser storage is not equivalent to secure device storage and should only be used for local development. The app validates stored sessions through `/api/v1/users/me` on startup.

## Validation

```bash
npm run typecheck
npm test -- --runInBand
```
