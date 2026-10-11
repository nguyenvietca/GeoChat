import { useLayoutEffect, useRef, useState } from 'react';
import { ChatMessage } from '../../types';
import { useOverlayFocus } from '../../hooks/useOverlayFocus';
import { supportedReactions } from './reactions';

type Props = {
  message: ChatMessage;
  busy: boolean;
  onReply: () => void;
  onReact: (key: string, add: boolean) => void;
};

export function MessageActions({ message, busy, onReply, onReact }: Props) {
  const [open, setOpen] = useState<'actions' | 'reactions' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [below, setBelow] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  useOverlayFocus(menuRef, open === null ? null : open === 'actions' ? 1 : 2, () => setOpen(null), false, false, openerRef);

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !triggerRef.current) return;
    const boundary = triggerRef.current.closest('.chat-message-area')?.getBoundingClientRect();
    const trigger = triggerRef.current.getBoundingClientRect();
    const height = menuRef.current.getBoundingClientRect().height;
    setBelow(trigger.top - height - 4 < Math.max(0, boundary?.top ?? 0));
  }, [open]);

  async function copy() {
    setOpen(null);
    try {
      if (!navigator.clipboard?.writeText) {
        setFeedback('Copy is unavailable. Select the message text to copy it.');
        return;
      }
      await navigator.clipboard.writeText(message.content);
      setFeedback('Text copied.');
    } catch { setFeedback('Could not copy. Select the message text to copy it.'); }
  }

  return <div className="message-actions">
    <div className="message-action-toolbar">
    <button type="button" className="message-action-trigger" aria-label={`React to message ${message.messageId}`}
      title="React" aria-haspopup="menu" aria-expanded={open === 'reactions'} onClick={(event) => {
        openerRef.current = event.currentTarget;
        setOpen(open === 'reactions' ? null : 'reactions');
      }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M8 14a4 4 0 0 0 8 0" /><path d="M8 9h.01M16 9h.01" strokeLinecap="round" strokeWidth="3" />
      </svg>
    </button>
    <button type="button" className="message-action-trigger" aria-label={`Reply to message ${message.messageId}`}
      title="Reply" onClick={() => { setOpen(null); onReply(); }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 5-6 6 6 6" /><path d="M3 11h10a7 7 0 0 1 7 7v1" />
      </svg>
    </button>
    <button ref={triggerRef} type="button" className="message-action-trigger" aria-label={`Actions for message ${message.messageId}`}
      aria-haspopup="menu" aria-expanded={open !== null} onClick={(event) => {
        openerRef.current = event.currentTarget;
        setOpen(open ? null : 'actions');
      }}>⋯</button>
    </div>
    {open ? <div ref={menuRef} className={`message-action-popover${below ? ' below' : ''}`} role="menu" aria-label={open === 'actions' ? 'Message actions' : 'Choose reaction'}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== openerRef.current) setOpen(null);
      }}>
      {open === 'actions' ? <>
        <button type="button" role="menuitem" onClick={() => { setOpen(null); onReply(); }}>Reply</button>
        <button type="button" role="menuitem" onClick={() => setOpen('reactions')}>React</button>
        {message.content ? <button type="button" role="menuitem" onClick={() => void copy()}>Copy text</button> : null}
      </> : supportedReactions.map((item) => {
        const selected = message.reactions?.some((reaction) => reaction.emoji === item.emoji && reaction.reactedByMe) ?? false;
        return <button key={item.key} type="button" role="menuitemcheckbox" aria-checked={selected} aria-label={item.label}
          disabled={busy} onClick={() => { onReact(item.key, !selected); setOpen(null); }}>{item.emoji}</button>;
      })}
    </div> : null}
    {(message.reactions?.length ?? 0) > 0 ? <div className="message-reactions" aria-label="Message reactions">
      {message.reactions?.map((reaction) => {
        const item = supportedReactions.find((option) => option.emoji === reaction.emoji);
        if (!item) return null;
        return <button key={item.key} className={reaction.reactedByMe ? 'reaction-badge selected' : 'reaction-badge'}
          type="button" aria-pressed={reaction.reactedByMe} aria-label={`${item.label}: ${reaction.count}${reaction.reactedByMe ? ', reacted by you' : ''}`}
          disabled={busy} onClick={() => onReact(item.key, !reaction.reactedByMe)}>{reaction.emoji} <span>{reaction.count}</span></button>;
      })}
    </div> : null}
    {feedback ? <small className="message-action-feedback" role="status">{feedback}</small> : null}
  </div>;
}
