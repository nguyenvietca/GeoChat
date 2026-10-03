# GeoChat Mobile

This Expo app is the mobile foundation for GeoChat. It includes centralized API configuration, a reusable HTTP client, secure token storage, and a simple authenticated flow for login/register/logout.

## Start

```bash
npm install
npx expo start
```

## Local backend configuration

The mobile app expects the backend to be running on port 8080.

By default, the app uses:

- Android emulator: http://10.0.2.2:8080
- iOS simulator: http://localhost:8080
- Expo web on the development machine: http://localhost:8080
- Physical device: set `EXPO_PUBLIC_API_BASE_URL` to the development machine's LAN IP

You can override it for local development with:

```bash
EXPO_PUBLIC_API_BASE_URL=http://<your-machine-ip>:8080 npx expo start
```

Examples:

- physical device on the same Wi-Fi: http://192.168.1.50:8080
- local machine: http://localhost:8080

## Authentication flow

The app uses the existing backend endpoints:

- POST /api/v1/auth/register
- POST /api/v1/auth/login
- GET /api/v1/users/me

On iOS and Android, tokens are stored with `expo-secure-store`. Expo web uses `localStorage` because the native secure store is unavailable there; browser storage is not equivalent to secure device storage and should only be used for local development. The app validates stored sessions through `/api/v1/users/me` on startup.
