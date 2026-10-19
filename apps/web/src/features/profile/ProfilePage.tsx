import { useLocale, translate as t, translateText as text } from '../../i18n';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { openDirectConversation } from '../../api/chats';
import { acceptFriendRequest, cancelFriendRequest, getFriendRelationship, removeFriend, sendFriendRequest } from '../../api/friends';
import { getPublicProfile, updateMyAvatar, updateMyProfile } from '../../api/users';
import { useAuth } from '../../app/providers/AuthContext';
import { FriendRelationship } from '../../types';
import { UserAvatar } from './UserAvatar';
import { createPortal } from 'react-dom';
import { useOverlayFocus } from '../../hooks/useOverlayFocus';

export function ProfilePage() {
  useLocale(); const { userId } = useParams(); return userId ? <PublicProfile userId={Number(userId)} /> : <MyProfile />; }

function PublicProfile({ userId }: { userId: number }) {
  useLocale();
  const { token } = useAuth(); const navigate = useNavigate();
  const [person, setPerson] = useState<{displayName:string;username:string;avatarUpdatedAt?:string|null}|null>(null);
  const [relationship, setRelationship] = useState<FriendRelationship>('NONE'); const [requestId, setRequestId] = useState<number|null>(null);
  const [busy, setBusy] = useState(false); const [failure, setFailure] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const removeTrigger = useRef<HTMLButtonElement>(null);
  const removing = useRef(false);
  useOverlayFocus(dialogRef, confirmRemove, () => setConfirmRemove(false), true, busy, removeTrigger);
  useEffect(() => { setConfirmRemove(false); }, [userId]);
  useEffect(() => { let active=true; setPerson(null); setFailure(''); if(token) void Promise.all([getPublicProfile(userId,token),getFriendRelationship(userId,token)]).then(([value,state])=>{if(active){setPerson(value);setRelationship(state.relationship);setRequestId(state.requestId);}}).catch(()=>{if(active)setFailure(t('profile.unavailable'));}); return()=>{active=false;}; },[userId,token]);
  async function act(action:'relationship'|'message'|'remove') { if(!token||busy)return; setBusy(true); setFailure(''); try {
    if(action==='message'){const chat=await openDirectConversation(userId,token);navigate(`/app/chat/${chat.conversationId}`);return;}
    if(action==='remove'){if(!person||removing.current)return;removing.current=true;await removeFriend(userId,token);setRelationship('NONE');setConfirmRemove(false);return;}
    if(relationship==='NONE'){const request=await sendFriendRequest(userId,token);setRelationship('PENDING_OUTGOING');setRequestId(request.requestId);}
    else if(relationship==='PENDING_OUTGOING'&&requestId){await cancelFriendRequest(requestId,token);setRelationship('NONE');setRequestId(null);}
    else if(relationship==='PENDING_INCOMING'&&requestId){await acceptFriendRequest(requestId,token);setRelationship('FRIENDS');setRequestId(null);}
  } catch(error){setFailure(error instanceof ApiError?error.message:t('profile.connectionFailed'));} finally{removing.current=false;setBusy(false);} }
  const label=relationship==='NONE'?t('common.addFriend'):relationship==='PENDING_OUTGOING'?t('common.cancelRequest'):relationship==='PENDING_INCOMING'?t('common.acceptRequest'):t('common.friends');
  return <section className="page-content public-profile-page">
    <div className="page-heading"><div><p className="eyebrow">PEOPLE ON GEOCHAT</p><h1>{t('profile.public')}</h1></div></div>
    <Link className="profile-back-link" to="/app/friends?tab=find">← Back to Find people</Link>
    {failure ? <p className="inline-error" role="alert">{text(failure)}</p> : null}
    {person ? <section className="profile-hero public-profile-hero" aria-label={`${person.displayName}'s profile`}>
      <div className="profile-identity">
        <UserAvatar userId={userId} displayName={person.displayName} avatarUpdatedAt={person.avatarUpdatedAt} token={token} className="profile-portrait" />
        <div className="profile-identity-copy"><p className="eyebrow">PUBLIC PROFILE</p><h2>{person.displayName}</h2><p className="profile-handle">@{person.username}</p>
          <span className="profile-connection-badge">{relationship==='FRIENDS'?t('profile.friend'):relationship==='PENDING_INCOMING'?t('profile.requestReceived'):relationship==='PENDING_OUTGOING'?t('profile.requestSent'):t('profile.member')}</span>
        </div>
      </div>
      <div className="profile-connection-actions">
        {relationship !== 'FRIENDS' ? <button className="primary-button" type="button" disabled={busy} onClick={()=>void act('relationship')}>{busy?t('common.working'):label}</button> : <>
          <button className="primary-button" type="button" disabled={busy} onClick={()=>void act('message')}>{t('common.message')}</button>
          <button ref={removeTrigger} className="quiet-light-button profile-remove-friend" type="button" disabled={busy} onClick={()=>{setFailure('');setConfirmRemove(true);}}>{t('common.removeFriend')}</button>
        </>}
      </div>
    </section> : !failure ? <p role="status">{t('profile.loading')}</p> : null}
    {confirmRemove && person ? createPortal(<div className="group-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setConfirmRemove(false); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="remove-friend-title" aria-describedby="remove-friend-help" aria-busy={busy} tabIndex={-1} className="group-confirm-dialog">
        <h2 id="remove-friend-title">{t('common.removeFriend')}</h2>
        <p id="remove-friend-help">{t('profile.removeConfirm', { name: person.displayName })}</p>
        {failure ? <p role="alert" className="error-message">{text(failure)}</p> : null}
        <div className="account-action-buttons"><button type="button" className="quiet-light-button" disabled={busy} onClick={() => setConfirmRemove(false)}>{t('common.cancel')}</button>
          <button type="button" className="primary-button" disabled={busy} onClick={() => void act('remove')}>{busy ? t('common.wait') : t('common.removeFriend')}</button></div>
      </div></div>, document.body) : null}
  </section>;
}

function MyProfile() {
  useLocale();
  const {user,token,syncUser}=useAuth(); const [displayName,setDisplayName]=useState(user?.displayName??''); const [email,setEmail]=useState(user?.email??''); const [phoneNumber,setPhoneNumber]=useState(user?.phoneNumber??'');
  const [saving,setSaving]=useState(false); const [uploading,setUploading]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState(''); const [nameInvalid,setNameInvalid]=useState(false);
  const [emailError, setEmailError] = useState('');
  const emailInput = useRef<HTMLInputElement>(null);
  useEffect(()=>{setDisplayName(user?.displayName??'');setEmail(user?.email??'');setPhoneNumber(user?.phoneNumber??'');},[user]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const name = displayName.trim();
    setEmailError('');
    if (name.length < 2 || name.length > 100) {
      setSuccess(''); setError(t('auth.nameLength')); setNameInvalid(true); return;
    }
    if (!token) { setError(t('auth.sessionExpired')); return; }
    setNameInvalid(false); setSaving(true); setError(''); setSuccess('');
    try {
      const updated = await updateMyProfile({ displayName: name, email: email.trim() || null, phoneNumber: phoneNumber.trim() || null }, token);
      syncUser(updated); setSuccess(t('profile.updated'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setEmailError(e.message);
      } else setError(e instanceof ApiError ? e.message : t('profile.updateFailed'));
    } finally { setSaving(false); }
  }
  useEffect(() => { if (emailError && !saving) emailInput.current?.focus(); }, [emailError, saving]);
  async function changeAvatar(event:ChangeEvent<HTMLInputElement>){const image=event.target.files?.[0];event.target.value='';if(!image||!token)return;setUploading(true);setError('');setSuccess('');try{const updated=await updateMyAvatar(image,token);syncUser(updated);setSuccess(t('profile.avatarUpdated'));}catch(e){setError(e instanceof ApiError?e.message:t('profile.avatarFailed'));}finally{setUploading(false);}}
  if(!user)return null; const unchanged=displayName===user.displayName&&email===(user.email??'')&&phoneNumber===(user.phoneNumber??'');
  return <section className="page-content profile-page"><div className="page-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>{t('common.profile')}</h1></div></div>
    <section className="profile-hero" aria-label="Your profile">
      <div className="profile-identity"><UserAvatar userId={user.id} displayName={user.displayName} avatarUpdatedAt={user.avatarUpdatedAt} token={token} className="profile-portrait" />
        <div className="profile-identity-copy"><p className="eyebrow">PERSONAL PROFILE</p><h2>{user.displayName}</h2><p className="profile-handle">@{user.username}</p>
          <label className="quiet-light-button avatar-upload-button">{uploading?t('profile.uploading'):t('profile.changeAvatar')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>void changeAvatar(event)} disabled={uploading}/></label>
          <p className="profile-avatar-help">JPG, PNG or WebP · up to 5 MB</p>
        </div>
      </div>
    </section>
    <div className="profile-details" aria-label="Profile information"><div><span className="summary-label">USERNAME</span><strong>@{user.username}</strong></div><div><span className="summary-label">EMAIL</span><strong>{user.email||t('profile.notProvided')}</strong></div><div><span className="summary-label">PHONE</span><strong>{user.phoneNumber||t('profile.notProvided')}</strong></div></div>
    <section className="profile-editor" aria-labelledby="edit-profile-heading"><div className="section-heading"><div><h2 id="edit-profile-heading">{t('profile.details')}</h2><p>{t('profile.detailsHelp')}</p></div></div>{error?<p className="inline-error" role="alert">{text(error)}</p>:null}{success?<p className="success-message" role="status">{text(success)}</p>:null}
      <form className="profile-form" noValidate onSubmit={event=>void save(event)}>
        <label className="field-label" htmlFor="profile-display-name">{t('auth.displayName')}</label>
        <input id="profile-display-name" type="text" minLength={2} maxLength={100} required value={displayName} onChange={event=>{setDisplayName(event.target.value);setNameInvalid(false);setError('');}} disabled={saving} aria-invalid={nameInvalid} aria-describedby={nameInvalid?'profile-name-error':undefined}/>
        <span id="profile-name-error" className="visually-hidden">{nameInvalid?error:''}</span>
        <label className="field-label" htmlFor="profile-email">{t('profile.email')}</label>
        <input ref={emailInput} id="profile-email" type="email" autoComplete="email" maxLength={320} value={email} onChange={event=>{setEmail(event.target.value);setEmailError('');}} disabled={saving} aria-invalid={!!emailError} aria-describedby={emailError?'profile-email-error':undefined}/>
        {emailError ? <p id="profile-email-error" className="profile-field-error" role="alert">{text(emailError)}</p> : null}
        <label className="field-label" htmlFor="profile-phone">{t('profile.phone')}</label>
        <input id="profile-phone" type="tel" autoComplete="tel" maxLength={32} value={phoneNumber} onChange={event=>setPhoneNumber(event.target.value)} disabled={saving}/>
        <p className="profile-field-help">{t('profile.privateHelp')}</p>
        <div className="profile-actions"><button className="primary-button" type="submit" disabled={saving}>{saving?t('profile.saving'):t('profile.save')}</button><button className="quiet-light-button" type="button" disabled={saving||unchanged} onClick={()=>{setDisplayName(user.displayName);setEmail(user.email??'');setPhoneNumber(user.phoneNumber??'');setNameInvalid(false);setEmailError('');setError('');setSuccess('');}}>{t('common.cancel')}</button></div>
      </form>
    </section></section>;
}
