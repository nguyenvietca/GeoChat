// @ts-expect-error Expo replaces this app-specific public variable when bundling.
const configuredMaximum = Number(process.env.EXPO_PUBLIC_MAX_GROUP_MEMBERS);

export const MAX_GROUP_MEMBERS = Number.isSafeInteger(configuredMaximum) && configuredMaximum > 0
  ? configuredMaximum
  : 100;

export const GROUP_NAME_MAX_LENGTH = 100;