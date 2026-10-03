export type UserSearchResult = {
  userId: number;
  displayName: string;
  username: string;
  relationship: string;
};

export type UserSearchResponse = {
  items: UserSearchResult[];
};

export type UpdateLocationRequest = {
  latitude: number;
  longitude: number;
};

export type CurrentLocation = UpdateLocationRequest & {
  updatedAt: string;
};

export type NearbyUser = {
  userId: number;
  displayName: string;
  distanceMeters: number;
};

export type NearbyUsersResponse = {
  items: NearbyUser[];
  radiusMeters: number;
};