import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { updateMyProfile } from '../../api/users';
import { useAuth } from '../../app/providers/AuthContext';

export function ProfilePage() {
  const { user, token, syncUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
  }, [user?.displayName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = displayName.trim();
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setSuccess('');
      setError('Display name must be between 2 and 100 characters.');
      return;
    }
    if (!token) {
      setSuccess('');
      setError('Your session has expired. Please sign in again.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updatedUser = await updateMyProfile({ displayName: normalizedName }, token);
      syncUser(updatedUser);
      setDisplayName(updatedUser.displayName);
      setSuccess('Profile updated.');
    } catch (updateError) {
      setError(updateError instanceof ApiError ? updateError.message : 'Unable to update your profile right now.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <section className="page-content profile-page">
      <div className="page-heading">
        <div><p className="eyebrow">YOUR ACCOUNT</p><h1>Profile</h1></div>
        <span className="profile-avatar" aria-hidden="true">{user.displayName.charAt(0).toUpperCase() || '?'}</span>
      </div>

      <div className="profile-details" aria-label="Profile information">
        <div><span className="summary-label">USERNAME</span><strong>@{user.username}</strong></div>
      </div>

      <section className="profile-editor" aria-labelledby="edit-profile-heading">
        <div className="section-heading">
          <div><h2 id="edit-profile-heading">Public profile</h2><p>Update the name other people see.</p></div>
        </div>
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        {success ? <p className="success-message" role="status">{success}</p> : null}
        <form className="profile-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
          <label className="field-label" htmlFor="profile-display-name">Display name</label>
          <input
            id="profile-display-name"
            name="displayName"
            type="text"
            autoComplete="nickname"
            minLength={2}
            maxLength={100}
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={saving}
          />
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </section>
    </section>
  );
}