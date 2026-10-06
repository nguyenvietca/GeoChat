export type User = {
  id: number;
  username: string;
  displayName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type LocationPoint = {
  latitude: number;
  longitude: number;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  tokenType: string;
};

export type RegisterRequest = {
  username: string;
  password: string;
  displayName: string;
};

export type UserSearchResult = {
  userId: number;
  displayName: string;
  username: string;
  relationship: string;
};

export type NearbyUser = {
  userId: number;
  displayName: string;
  distanceMeters: number;
};

export type UserSearchResponse = {
  items: UserSearchResult[];
};

export type NearbyUsersResponse = {
  items: NearbyUser[];
  radiusMeters: number;
};
