import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { getFriends, sendFriendRequest } from '../../api/friends';
import { openContextualConversation, openDirectConversation } from '../../api/chats';
import { addGroupMembers, getGroupMembers, GROUP_NAME_MAX_LENGTH, leaveGroup, MAX_GROUP_MEMBERS, removeGroupMember, renameGroup } from '../../api/groups';
import { FriendSummary, GroupInfo, GroupMember } from '../../types';

type GroupInfoPanelProps = {
  group: GroupInfo;
  currentUserId: number | null;
  token: string;
  onClose: () => void;
  onLeft: () => void;
  onOpenConversation: (conversationId: number) => void;
  onGroupChanged: (group: GroupInfo) => void;
};

type Confirmation = { action: 'remove'; member: GroupMember } | { action: 'leave' };

export function GroupInfoPanel({ group, currentUserId, token, onClose, onLeft, onOpenConversation, onGroupChanged }: GroupInfoPanelProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [friends, setFriends] = useState<FriendSummary[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [groupName, setGroupName] = useState(group.name);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [memberMenuId, setMemberMenuId] = useState<number | null>(null);
  const [memberMenuLoading, setMemberMenuLoading] = useState(false);
  const [requestedFriendIds, setRequestedFriendIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setGroupName(group.name);
    getGroupMembers(group.groupId, token)
      .then((response) => { if (active) setMembers(response.items); })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof ApiError ? loadError.message : 'Unable to load group members.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [group.groupId, group.name, group.memberCount, group.updatedAt, token]);

  const isOwner = group.owner.userId === currentUserId;
  const currentMember = members.find((member) => member.user.userId === currentUserId);
  const memberIds = new Set(members.map((member) => member.user.userId));
  const candidates = (friends ?? []).filter((friend) => friend.userId !== currentUserId && !memberIds.has(friend.userId));
  const roomLeft = MAX_GROUP_MEMBERS - group.memberCount;

  const loadFriends = async () => {
    if (friends !== null) return friends;
    const response = await getFriends(token);
    setFriends(response.items);
    return response.items;
  };

  const toggleMemberMenu = async (userId: number) => {
    if (memberMenuId === userId) {
      setMemberMenuId(null);
      return;
    }
    setMemberMenuId(userId);
    if (friends !== null) return;
    setMemberMenuLoading(true);
    try {
      await loadFriends();
    } catch (friendError) {
      setError(friendError instanceof ApiError ? friendError.message : 'Unable to load friends.');
      setMemberMenuId(null);
    } finally {
      setMemberMenuLoading(false);
    }
  };

  const handleAddFriend = async (member: GroupMember) => {
    setError('');
    setNotice('');
    try {
      await sendFriendRequest(member.user.userId, token);
      setRequestedFriendIds((current) => new Set(current).add(member.user.userId));
      setNotice(`Friend request sent to ${member.user.displayName}.`);
      setMemberMenuId(null);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to send this friend request.');
    }
  };

  const handleMessageMember = async (member: GroupMember) => {
    setError('');
    setMemberMenuLoading(true);
    try {
      const availableFriends = await loadFriends();
      const isFriend = availableFriends.some((friend) => friend.userId === member.user.userId);
      const conversation = isFriend
        ? await openDirectConversation(member.user.userId, token)
        : await openContextualConversation(member.user.userId, undefined, token);
      setMemberMenuId(null);
      onOpenConversation(conversation.conversationId);
    } catch (messageError) {
      setError(messageError instanceof ApiError ? messageError.message : 'Unable to open this conversation.');
    } finally {
      setMemberMenuLoading(false);
    }
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = groupName.trim();
    if (!name) {
      setError('Enter a group name.');
      setNotice('');
      return;
    }
    if (name.length > GROUP_NAME_MAX_LENGTH) {
      setError(`Group names can be at most ${GROUP_NAME_MAX_LENGTH} characters.`);
      setNotice('');
      return;
    }
    if (renaming || name === group.name) return;

    setRenaming(true);
    setError('');
    setNotice('');
    try {
      onGroupChanged(await renameGroup(group.groupId, name, token));
      setNotice('Group name updated.');
    } catch (renameError) {
      setError(renameError instanceof ApiError ? renameError.message : 'Unable to update the group name.');
    } finally {
      setRenaming(false);
    }
  };

  const toggleAdd = async () => {
    const next = !showAdd;
    setShowAdd(next);
    setSelected([]);
    if (next && friends === null) {
      try {
        await loadFriends();
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
    setNotice('');
    try {
      onGroupChanged(await addGroupMembers(group.groupId, selected, token));
      setSelected([]);
      setShowAdd(false);
    } catch (addError) {
      setError(addError instanceof ApiError ? addError.message : 'Unable to add members.');
    } finally {
      setAdding(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmation || leaving || removingId !== null) return;
    setError('');
    setNotice('');
    if (confirmation.action === 'leave') {
      setLeaving(true);
      try {
        await leaveGroup(group.groupId, token);
        setConfirmation(null);
        onLeft();
      } catch (leaveError) {
        setError(leaveError instanceof ApiError ? leaveError.message : 'Unable to leave this group.');
        setLeaving(false);
      }
      return;
    }
    const member = confirmation.member;
    setRemovingId(member.user.userId);
    try {
      onGroupChanged(await removeGroupMember(group.groupId, member.user.userId, token));
      setConfirmation(null);
    } catch (removeError) {
      setError(removeError instanceof ApiError ? removeError.message : 'Unable to remove this member.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="group-info-panel" aria-label="Group information">
      <div className="group-info-heading">
        <div><strong>{group.name}</strong><small>Owner: {group.owner.displayName} · Members: {group.memberCount}</small>
          {currentMember ? <small>Your role: {currentMember.role.toLowerCase()}</small> : null}</div>
        <button className="quiet-light-button" type="button" onClick={onClose}>Close</button>
      </div>
      {loading ? <div className="result-state" role="status"><span className="spinner" />Loading members…</div> : null}
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      {notice ? <p className="inline-notice" role="status">{notice}</p> : null}
      {isOwner ? (
        <form className="group-rename-form" aria-label="Rename group" onSubmit={(event) => void handleRename(event)}>
          <label htmlFor="group-name">Group name</label>
          <input id="group-name" type="text" value={groupName} maxLength={GROUP_NAME_MAX_LENGTH}
            onChange={(event) => setGroupName(event.target.value)} disabled={renaming} />
          <button className="quiet-light-button compact-button" type="submit"
            disabled={renaming || !groupName.trim() || groupName.trim() === group.name}>
            {renaming ? 'Saving…' : 'Save name'}
          </button>
        </form>
      ) : null}
      <ul className="group-member-list">
        {members.map((member) => (
          <li key={member.user.userId}>
            <span>{member.user.displayName} <small>@{member.user.username}</small></span>
            <div className="group-member-actions">
              {member.role === 'OWNER' ? <b className="group-owner-badge">Owner</b> : null}
              {member.user.userId !== currentUserId ? (
                <div className="group-member-menu">
                  <button className="group-member-menu-trigger" type="button" aria-label={`More actions for ${member.user.displayName}`}
                    aria-expanded={memberMenuId === member.user.userId} onClick={() => void toggleMemberMenu(member.user.userId)}>
                    <span aria-hidden="true">•••</span>
                  </button>
                  {memberMenuId === member.user.userId ? (
                    <div className="group-member-menu-list" role="menu" aria-label={`${member.user.displayName} actions`}>
                      {memberMenuLoading ? <span role="status">Loading…</span> : (
                        <>
                          {friends?.some((friend) => friend.userId === member.user.userId) ? (
                            <button type="button" role="menuitem" disabled>Friends</button>
                          ) : (
                            <button type="button" role="menuitem" disabled={requestedFriendIds.has(member.user.userId)}
                              onClick={() => void handleAddFriend(member)}>
                              {requestedFriendIds.has(member.user.userId) ? 'Request sent' : 'Add friend'}
                            </button>
                          )}
                          <button type="button" role="menuitem" onClick={() => void handleMessageMember(member)}>Message</button>
                          {isOwner && member.role !== 'OWNER' ? (
                            <button className="menu-danger-action" type="button" role="menuitem"
                              onClick={() => { setMemberMenuId(null); setConfirmation({ action: 'remove', member }); }}>
                              Remove from group
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
        {!loading && !error && members.length === 0 ? <li className="group-form-hint">No members are available.</li> : null}
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
              {friends !== null && candidates.length === 0 ? <p className="group-form-hint">{friends.length === 0 ? 'No friends are available to add.' : 'All your friends are already in this group.'}</p> : null}
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
        <button className="group-leave-button" type="button" onClick={() => setConfirmation({ action: 'leave' })} disabled={leaving}>
          Leave group
        </button>
      )}
      {confirmation ? (
        <div className="group-confirm-backdrop">
          <section className="group-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="group-confirm-title">
            <h2 id="group-confirm-title">{confirmation.action === 'leave' ? 'Leave this group?' : 'Remove this member?'}</h2>
            <p>{confirmation.action === 'leave'
              ? 'You will lose access to this conversation and its messages.'
              : `${confirmation.member.user.displayName} will lose access to this group and its messages.`}</p>
            {error ? <p className="inline-error" role="alert">{error}</p> : null}
            <div className="group-confirm-actions">
              <button className="quiet-light-button" type="button" onClick={() => { setConfirmation(null); setError(''); }}
                disabled={leaving || removingId !== null}>Cancel</button>
              <button className="group-confirm-danger" type="button" onClick={() => void handleConfirm()}
                disabled={leaving || removingId !== null}>
                {leaving || removingId !== null ? 'Working…' : confirmation.action === 'leave' ? 'Leave group' : 'Remove member'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
