import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { getFriends, getIncomingFriendRequests, getOutgoingFriendRequests, sendFriendRequest } from '../api/friendApi';
import { getNearbyUsers, updateMyLocation } from '../api/locationApi';
import { NearbyUsersScreen } from '../screens/NearbyUsersScreen';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../api/friendApi', () => ({
  getFriends: jest.fn(),
  getIncomingFriendRequests: jest.fn(),
  getOutgoingFriendRequests: jest.fn(),
  sendFriendRequest: jest.fn(),
}));
jest.mock('../api/locationApi', () => ({
  getNearbyUsers: jest.fn(),
  updateMyLocation: jest.fn(),
}));

const mockGetFriends = jest.mocked(getFriends);
const mockGetIncoming = jest.mocked(getIncomingFriendRequests);
const mockGetOutgoing = jest.mocked(getOutgoingFriendRequests);
const mockSendFriendRequest = jest.mocked(sendFriendRequest);
const mockGetNearbyUsers = jest.mocked(getNearbyUsers);
const mockUpdateMyLocation = jest.mocked(updateMyLocation);
const mockGetPermission = jest.mocked(Location.getForegroundPermissionsAsync);
const mockGetPosition = jest.mocked(Location.getCurrentPositionAsync);

const nearbyUser = { userId: 3, displayName: 'Kai', distanceMeters: 600 };

describe('Nearby social actions', () => {
  const onBack = jest.fn();
  const onOpenFriends = jest.fn();
  const onMessageUser = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermission.mockResolvedValue({ granted: true, canAskAgain: true } as Location.LocationPermissionResponse);
    mockGetPosition.mockResolvedValue({
      coords: { latitude: 41.2, longitude: -72.8 },
    } as Location.LocationObject);
    mockUpdateMyLocation.mockResolvedValue({ latitude: 41.2, longitude: -72.8, updatedAt: '' });
    mockGetNearbyUsers.mockResolvedValue({ items: [nearbyUser], radiusMeters: 5000 });
    mockGetFriends.mockResolvedValue({ items: [] });
    mockGetIncoming.mockResolvedValue({ items: [] });
    mockGetOutgoing.mockResolvedValue({ items: [] });
    mockSendFriendRequest.mockResolvedValue({ requestId: 21, senderId: 1, receiverId: 3, status: 'PENDING', createdAt: '', updatedAt: '' });
  });

  function renderScreen() {
    render(
      <NearbyUsersScreen
        token="test-token"
        onBack={onBack}
        onOpenFriends={onOpenFriends}
        onMessageUser={onMessageUser}
      />,
    );
  }

  it('sends a friend request to a nearby user', async () => {
    renderScreen();

    fireEvent.press(await screen.findByRole('button', { name: 'Add Friend' }));

    await waitFor(() => expect(mockSendFriendRequest).toHaveBeenCalledWith(3, 'test-token'));
    expect(await screen.findByText('Request sent')).toBeTruthy();
  });

  it('opens a direct conversation for a nearby friend', async () => {
    mockGetFriends.mockResolvedValue({ items: [{ userId: 3, displayName: 'Kai' }] });
    renderScreen();

    fireEvent.press(await screen.findByRole('button', { name: 'Message' }));

    await waitFor(() => expect(onMessageUser).toHaveBeenCalledWith({ userId: 3, displayName: 'Kai' }));
  });

  it('opens incoming requests when a nearby user has already requested friendship', async () => {
    mockGetIncoming.mockResolvedValue({ items: [{ requestId: 20, user: { userId: 3, displayName: 'Kai' }, createdAt: '' }] });
    renderScreen();

    fireEvent.press(await screen.findByRole('button', { name: 'Review request' }));

    expect(onOpenFriends).toHaveBeenCalledWith('incoming');
  });
});