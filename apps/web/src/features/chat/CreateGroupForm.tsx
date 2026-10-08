import { FormEvent, useState } from 'react';
import { ApiError } from '../../api/client';
import { createGroup, GROUP_NAME_MAX_LENGTH, MAX_GROUP_MEMBERS } from '../../api/groups';
import { FriendSummary } from '../../types';

type CreateGroupFormProps = {
  friends: FriendSummary[];
  currentUserId: number | null;
  token: string;
  onCreated: (groupId: number) => void;
  onCancel: () => void;
};

export function CreateGroupForm({ friends, currentUserId, token, onCreated, onCancel }: CreateGroupFormProps) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const candidates = friends.filter((friend) => friend.userId !== currentUserId);
  const limitReached = selected.length + 1 >= MAX_GROUP_MEMBERS;

  const toggle = (userId: number) => setSelected((current) => current.includes(userId)
    ? current.filter((id) => id !== userId)
    : current.length + 1 < MAX_GROUP_MEMBERS ? [...current, userId] : current);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Enter a group name.'); return; }
    if (trimmed.length > GROUP_NAME_MAX_LENGTH) { setError(`Group names must be ${GROUP_NAME_MAX_LENGTH} characters or fewer.`); return; }
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const group = await createGroup({ name: trimmed, memberIds: selected }, token);
      onCreated(group.groupId);
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : 'Unable to create this group.');
      setCreating(false);
    }
  };

  return (
    <form className="create-group-form" onSubmit={(event) => void submit(event)} aria-label="Create group">
      <label htmlFor="group-name">Group name</label>
      <input id="group-name" value={name} maxLength={GROUP_NAME_MAX_LENGTH + 1} disabled={creating}
        onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Group name" />
      <fieldset disabled={creating}>
        <legend>Add friends ({selected.length} selected)</legend>
        {candidates.length === 0 ? <p className="group-form-hint">No friends yet. Add friends to start chatting.</p> : null}
        {candidates.map((friend) => (
          <label className="group-friend-option" key={friend.userId}>
            <input type="checkbox" checked={selected.includes(friend.userId)}
              disabled={!selected.includes(friend.userId) && limitReached} onChange={() => toggle(friend.userId)} />
            <span>{friend.displayName} <small>@{friend.username}</small></span>
          </label>
        ))}
      </fieldset>
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      <div className="group-form-actions">
        <button className="quiet-light-button" type="button" onClick={onCancel} disabled={creating}>Cancel</button>
        <button className="primary-button" type="submit" disabled={creating}>{creating ? 'Creating group…' : 'Create group'}</button>
      </div>
    </form>
  );
}
