import React from 'react';
import { Alert, Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../api/client';
import { GroupInfoScreen } from '../screens/GroupInfoScreen';
import { getGroup, getGroupMembers, leaveGroup, addGroupMembers, removeGroupMember } from '../api/groupApi';
import { getFriends } from '../api/friendApi';

jest.mock('../api/friendApi', () => ({ getFriends: jest.fn() }));
jest.mock('../api/groupApi', () => ({
  getGroup: jest.fn(),
  getGroupMembers: jest.fn(),
  leaveGroup: jest.fn(),
  addGroupMembers: jest.fn(),
  removeGroupMember: jest.fn(),
}));

const mockAddMembers = addGroupMembers as jest.MockedFunction<typeof addGroupMembers>;
const mockRemoveMember = removeGroupMember as jest.MockedFunction<typeof removeGroupMember>;
const mockGetFriends = getFriends as jest.MockedFunction<typeof getFriends>;

const mockGetGroup = getGroup as jest.MockedFunction<typeof getGroup>;
const mockGetGroupMembers = getGroupMembers as jest.MockedFunction<typeof getGroupMembers>;
const mockLeaveGroup = leaveGroup as jest.MockedFunction<typeof leaveGroup>;

const group = {
  groupId: 42,
  name: 'Weekend hikers',
  owner: { userId: 1, username: 'owner', displayName: 'Owner' },
  memberCount: 2,
  createdAt: '',
  updatedAt: '',
};
const members = {
  items: [
    { user: group.owner, role: 'OWNER', joinedAt: '' },
    { user: { userId: 2, username: 'alice', displayName: 'Alice' }, role: 'MEMBER', joinedAt: '' },
  ],
};

describe('GroupInfoScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGroup.mockResolvedValue(group);
    mockGetGroupMembers.mockResolvedValue(members);
  });

  it('loads group details and labels the owner and members', async () => {
    render(<GroupInfoScreen groupId={42} currentUserId={2} token="jwt" onBack={jest.fn()} onLeft={jest.fn()} />);

    expect(await screen.findByText('Weekend hikers')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getAllByText('Owner', { exact: true })).toHaveLength(2);
    expect(screen.getByText('Leave Group')).toBeTruthy();
  });

  it('lets the owner add members repeatedly and remove a member', async () => {
    mockGetFriends.mockResolvedValue({ items: [
      { userId: 2, displayName: 'Alice' },
      { userId: 3, displayName: 'Bob' },
      { userId: 4, displayName: 'Cara' },
    ] });
    mockAddMembers.mockResolvedValue({ ...group, memberCount: 3 });
    mockRemoveMember.mockResolvedValue({ ...group, memberCount: 1 });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((button) => button.text === 'Remove')?.onPress?.();
    });
    render(<GroupInfoScreen groupId={42} currentUserId={1} token="jwt" onBack={jest.fn()} onLeft={jest.fn()} />);
    await screen.findByText('Weekend hikers');

    fireEvent.press(screen.getByText('Add members'));
    fireEvent.press(await screen.findByRole('checkbox', { name: 'Select Bob' }));
    fireEvent.press(screen.getByText('Add selected'));
    await waitFor(() => expect(mockAddMembers).toHaveBeenCalledWith(42, [3], 'jwt'));

    fireEvent.press(await screen.findByText('Add members'));
    fireEvent.press(await screen.findByRole('checkbox', { name: 'Select Cara' }));
    fireEvent.press(screen.getByText('Add selected'));
    await waitFor(() => expect(mockAddMembers).toHaveBeenLastCalledWith(42, [4], 'jwt'));

    fireEvent.press(await screen.findByRole('button', { name: 'Remove Alice' }));
    await waitFor(() => expect(mockRemoveMember).toHaveBeenCalledWith(42, 2, 'jwt'));
    alert.mockRestore();
  });

  it('does not offer owners a leave action', async () => {
    render(<GroupInfoScreen groupId={42} currentUserId={1} token="jwt" onBack={jest.fn()} onLeft={jest.fn()} />);

    expect(await screen.findByText(/owners cannot leave/i)).toBeTruthy();
    expect(screen.queryByText('Leave Group')).toBeNull();
  });

  it('uses window.confirm on web before leaving', async () => {
    const onLeft = jest.fn();
    mockLeaveGroup.mockResolvedValue(undefined);
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const confirm = jest.fn().mockReturnValue(true);
    (globalThis as unknown as { window: unknown }).window = { confirm };
    render(<GroupInfoScreen groupId={42} currentUserId={2} token="jwt" onBack={jest.fn()} onLeft={onLeft} />);
    await screen.findByText('Weekend hikers');

    fireEvent.press(screen.getByText('Leave Group'));

    await waitFor(() => expect(onLeft).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to leave this group?');
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  it('returns to Chats when group authorization is rejected', async () => {
    const onAccessDenied = jest.fn();
    mockGetGroup.mockRejectedValue(new ApiError('No access', 'forbidden', 403));
    render(<GroupInfoScreen
      groupId={42}
      currentUserId={2}
      token="jwt"
      onBack={jest.fn()}
      onLeft={jest.fn()}
      onAccessDenied={onAccessDenied}
    />);

    await waitFor(() => expect(onAccessDenied).toHaveBeenCalledWith('This group is unavailable or you are no longer a member.'));
  });

  it('confirms before leaving and returns to the conversation list after success', async () => {
    const onLeft = jest.fn();
    mockLeaveGroup.mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Leave Group')?.onPress?.();
    });
    render(<GroupInfoScreen groupId={42} currentUserId={2} token="jwt" onBack={jest.fn()} onLeft={onLeft} />);
    await screen.findByText('Weekend hikers');

    fireEvent.press(screen.getByText('Leave Group'));

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith(
        'Leave group',
        'Are you sure you want to leave this group?',
        expect.any(Array),
      );
      expect(mockLeaveGroup).toHaveBeenCalledWith(42, 'jwt');
      expect(onLeft).toHaveBeenCalledTimes(1);
    });
    alert.mockRestore();
  });
});