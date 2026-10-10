import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { updateMyProfile } from '../../api/users';
import { useAuth } from '../../app/providers/AuthContext';

export function ProfilePage() {
  const { user, token, syncUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState(false);
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
      setFieldError(true);
      return;
    }
    if (!token) {
      setSuccess('');
      setError('Your session has expired. Please sign in again.');
      return;
    }

    setFieldError(false);
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updatedUser = await updateMyProfile({ displayName: normalizedName }, token);
      syncUser(updatedUser);
      setDisplayName(updatedUser.displayName);
      setSuccess('Profile updated.');
    } catch (updateError) {
      setFieldError(updateError instanceof ApiError && updateError.status === 400);
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
        {error ? <p className="inline-error" role="alert" id="profile-name-error">{error}</p> : null}
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
            onChange={(event) => { setDisplayName(event.target.value); setFieldError(false); setError(''); setSuccess(''); }}
            aria-invalid={fieldError} aria-describedby={error ? 'profile-name-help profile-name-error' : 'profile-name-help'}
            disabled={saving}
          />
          <p className="profile-field-help" id="profile-name-help">Use 2-100 characters. This is the name people see in conversations.</p>
          <div className="profile-actions">
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
            <button className="quiet-light-button" type="button" disabled={saving || displayName === user.displayName}
              onClick={() => { setDisplayName(user.displayName); setError(''); setSuccess(''); setFieldError(false); }}>Cancel</button>
          </div>
        </form>
      </section>
    </section>
  );
}