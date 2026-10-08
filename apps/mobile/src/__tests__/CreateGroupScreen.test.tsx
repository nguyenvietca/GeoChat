import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CreateGroupScreen } from '../screens/CreateGroupScreen';
import { getFriends } from '../api/friendApi';
import { createGroup } from '../api/groupApi';

jest.mock('../api/friendApi', () => ({ getFriends: jest.fn() }));
jest.mock('../api/groupApi', () => ({ createGroup: jest.fn() }));

const mockGetFriends = getFriends as jest.MockedFunction<typeof getFriends>;
const mockCreateGroup = createGroup as jest.MockedFunction<typeof createGroup>;

describe('CreateGroupScreen', () => {
  const onGroupCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFriends.mockResolvedValue({
      items: [
        { userId: 1, displayName: 'Current user' },
        { userId: 2, username: 'alice', displayName: 'Alice' },
      ],
    });
    mockCreateGroup.mockResolvedValue({
      groupId: 42,
      name: 'Hikers',
      owner: { userId: 1, username: 'me', displayName: 'Me' },
      memberCount: 2,
      createdAt: '',
      updatedAt: '',
    });
  });

  it('loads friends, excludes the current user, and creates then opens a group', async () => {
    render(<CreateGroupScreen token="jwt" currentUserId={1} onBack={jest.fn()} onGroupCreated={onGroupCreated} />);

    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.queryByText('Current user')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Group name'), '  Hikers  ');
    fireEvent.press(screen.getByRole('checkbox', { name: 'Select Alice' }));
    fireEvent.press(screen.getByText('Create group'));

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'Hikers', memberIds: [2] }, 'jwt');
      expect(onGroupCreated).toHaveBeenCalledWith(42);
    });
  });

  it('rejects an empty group name without calling the API', async () => {
    render(<CreateGroupScreen token="jwt" currentUserId={1} onBack={jest.fn()} onGroupCreated={onGroupCreated} />);
    await screen.findByText('Alice');

    fireEvent.press(screen.getByText('Create group'));

    expect(screen.getByText('Enter a group name.')).toBeTruthy();
    expect(mockCreateGroup).not.toHaveBeenCalled();
  });

  it('rejects a group name longer than the backend limit', async () => {
    render(<CreateGroupScreen token="jwt" currentUserId={1} onBack={jest.fn()} onGroupCreated={onGroupCreated} />);
    await screen.findByText('Alice');

    fireEvent.changeText(screen.getByLabelText('Group name'), 'x'.repeat(101));
    fireEvent.press(screen.getByText('Create group'));

    expect(screen.getByText('Group names must be 100 characters or fewer.')).toBeTruthy();
    expect(mockCreateGroup).not.toHaveBeenCalled();
  });

  it('allows a friend to be selected and deselected without duplicate IDs', async () => {
    render(<CreateGroupScreen token="jwt" currentUserId={1} onBack={jest.fn()} onGroupCreated={onGroupCreated} />);
    const friend = await screen.findByRole('checkbox', { name: 'Select Alice' });

    fireEvent.press(friend);
    expect(screen.getByText('1 selected')).toBeTruthy();
    expect(screen.getByText('Selected: Alice')).toBeTruthy();
    fireEvent.press(friend);
    expect(screen.getByText('0 selected')).toBeTruthy();
    expect(screen.getByText('No friends selected')).toBeTruthy();
  });
});