import { Platform } from 'react-native';

const defaultLocalHost = Platform.select({
  android: '10.0.2.2',
  ios: 'localhost',
  default: 'localhost',
});

// @ts-expect-error Expo replaces this app-specific public variable when bundling.
const configuredApiBaseUrl: string | undefined = process.env.EXPO_PUBLIC_API_BASE_URL;

export const API_BASE_URL = configuredApiBaseUrl ?? `http://${defaultLocalHost}:8080`;

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL.replace(/\/$/, '')}${normalizedPath}`;
};

export const API_TIMEOUT_MS = 15000;
