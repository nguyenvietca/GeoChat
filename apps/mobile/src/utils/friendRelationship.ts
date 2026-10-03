export type FriendRelationshipState =
  | 'SELF'
  | 'FRIEND'
  | 'INCOMING_REQUEST'
  | 'OUTGOING_REQUEST'
  | 'NONE';

export function getFriendRelationshipState(
  relationship: string,
  currentUserId: number | null,
  resultUserId: number,
): FriendRelationshipState {
  if (currentUserId !== null && currentUserId === resultUserId) {
    return 'SELF';
  }

  switch (relationship) {
    case 'FRIENDS':
      return 'FRIEND';
    case 'PENDING_INCOMING':
      return 'INCOMING_REQUEST';
    case 'PENDING_OUTGOING':
      return 'OUTGOING_REQUEST';
    default:
      return 'NONE';
  }
}