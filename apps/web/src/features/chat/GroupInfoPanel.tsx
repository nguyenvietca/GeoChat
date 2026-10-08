import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { getFriends } from '../../api/friends';
import { addGroupMembers, getGroupMembers, leaveGroup, MAX_GROUP_MEMBERS, removeGroupMember } from '../../api/groups';
import { FriendSummary, GroupInfo, GroupMember } from '../../types';

type GroupInfoPanelProps = {
  group: GroupInfo;
  currentUserId: number | null;
  token: string;
  onClose: () => void;
  onLeft: () => void;
  onGroupChanged: (group: GroupInfo) => void;
};

export function GroupInfoPanel({ group, currentUserId, token, onClose, onLeft, onGroupChanged }: GroupInfoPanelProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [friends, setFriends] = useState<FriendSummary[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState('');

  const loadMembers = async () => {
    const response = await getGroupMembers(group.groupId, token);
    setMembers(response.items);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    getGroupMembers(group.groupId, token)
      .then((response) => { if (active) setMembers(response.items); })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof ApiError ? loadError.message : 'Unable to load group members.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [group.groupId, token]);

  const isOwner = group.owner.userId === currentUserId;
  const memberIds = new Set(members.map((member) => member.user.userId));
  const candidates = (friends ?? []).filter((friend) => !memberIds.has(friend.userId));
  const roomLeft = MAX_GROUP_MEMBERS - group.memberCount;

  const toggleAdd = async () => {
    const next = !showAdd;
    setShowAdd(next);
    setSelected([]);
    if (next && friends === null) {
      try {
        setFriends((await getFriends(token)).items);
      } catch (friendError) {
        setError(friendError instanceof ApiError ? friendError.message : 'Unable to load friends.');
        setShowAdd(false);
      }
    }
  };

  const toggleFriend = (userId: number) => setSelected((current) => current.includes(userId)
    ? current.filter((id) => id !== userId)
    : current.length < roomLeft ? [...current, userId] : current);

  const handleAdd = async () => {
    if (adding || selected.length === 0) return;
    setAdding(true);
    setError('');
    try {
      onGroupChanged(await addGroupMembers(group.groupId, selected, token));
      await loadMembers();
      setSelected([]);
      setShowAdd(false);
    } catch (addError) {
      setError(addError instanceof ApiError ? addError.message : 'Unable to add members.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (member: GroupMember) => {
    if (removingId !== null || !window.confirm(`Remove ${member.user.displayName} from this group?`)) return;
    setRemovingId(member.user.userId);
    setError('');
    try {
      onGroupChanged(await removeGroupMember(group.groupId, member.user.userId, token));
      await loadMembers();
    } catch (removeError) {
      setError(removeError instanceof ApiError ? removeError.message : 'Unable to remove this member.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleLeave = async () => {
    if (leaving || !window.confirm('Are you sure you want to leave this group?')) return;
    setLeaving(true);
    setError('');
    try {
      await leaveGroup(group.groupId, token);
      onLeft();
    } catch (leaveError) {
      setError(leaveError instanceof ApiError ? leaveError.message : 'Unable to leave this group.');
      setLeaving(false);
    }
  };

  return (
    <section className="group-info-panel" aria-label="Group information">
      <div className="group-info-heading">
        <div><strong>{group.name}</strong><small>Members: {group.memberCount}</small></div>
        <button className="quiet-light-button" type="button" onClick={onClose}>Close</button>
      </div>
      {loading ? <div className="result-state" role="status"><span className="spinner" />Loading members…</div> : null}
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      <ul className="group-member-list">
        {members.map((member) => (
          <li key={member.user.userId}>
            <span>{member.user.displayName} <small>@{member.user.username}</small></span>
            {member.role === 'OWNER' ? <b className="group-owner-badge">Owner</b> : isOwner ? (
              <button className="quiet-button compact-button" type="button" aria-label={`Remove ${member.user.displayName}`}
                onClick={() => void handleRemove(member)} disabled={removingId !== null}>
                {removingId === member.user.userId ? 'Removing…' : 'Remove'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <>
          <button className="quiet-light-button compact-button" type="button" aria-expanded={showAdd} onClick={() => void toggleAdd()} disabled={roomLeft <= 0 && !showAdd}>
            {roomLeft <= 0 ? 'Group is full' : 'Add members'}
          </button>
          {showAdd ? (
            <fieldset className="group-add-members" disabled={adding}>
              <legend>Add friends ({selected.length} selected)</legend>
              {friends === null ? <div className="result-state" role="status"><span className="spinner" />Loading friends…</div> : null}
              {friends !== null && candidates.length === 0 ? <p className="group-form-hint">All your friends are already in this group.</p> : null}
              {candidates.map((friend) => (
                <label className="group-friend-option" key={friend.userId}>
                  <input type="checkbox" checked={selected.includes(friend.userId)}
                    disabled={!selected.includes(friend.userId) && selected.length >= roomLeft} onChange={() => toggleFriend(friend.userId)} />
                  <span>{friend.displayName} <small>@{friend.username}</small></span>
                </label>
              ))}
              <button className="primary-button compact-button" type="button" onClick={() => void handleAdd()} disabled={adding || selected.length === 0}>
                {adding ? 'Adding…' : 'Add selected'}
              </button>
            </fieldset>
          ) : null}
          <p className="group-owner-note">Owners cannot leave until ownership transfer is supported.</p>
        </>
      ) : (
        <button className="quiet-button" type="button" onClick={() => void handleLeave()} disabled={leaving}>
          {leaving ? 'Leaving group…' : 'Leave group'}
        </button>
      )}
    </section>
  );
}
