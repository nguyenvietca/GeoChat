import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'geochat.accessToken';
const TOKEN_TYPE_KEY = 'geochat.tokenType';

const webStorage = () => {
  if (Platform.OS !== 'web') {
    return null;
  }

  return globalThis.localStorage;
};

export async function saveTokens(token: string, tokenType: string) {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(TOKEN_KEY, token);
    webStorage()?.setItem(TOKEN_TYPE_KEY, tokenType);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(TOKEN_TYPE_KEY, tokenType);
}

export async function getToken() {
  if (Platform.OS === 'web') {
    return webStorage()?.getItem(TOKEN_KEY) ?? null;
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getTokenType() {
  if (Platform.OS === 'web') {
    return webStorage()?.getItem(TOKEN_TYPE_KEY) ?? 'Bearer';
  }

  return SecureStore.getItemAsync(TOKEN_TYPE_KEY) ?? 'Bearer';
}

export async function clearTokens() {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(TOKEN_KEY);
    webStorage()?.removeItem(TOKEN_TYPE_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(TOKEN_TYPE_KEY);
}
