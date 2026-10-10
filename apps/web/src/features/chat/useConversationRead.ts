import { RefObject, useCallback, useEffect, useRef } from 'react';
import { markConversationRead } from '../../api/chats';
import { ChatMessage, ConversationReadState } from '../../types';
import { compareMessageOrder } from './messagePresentation';

// A message is considered viewed when its bottom enters the visible chat viewport.
// The server resolves its (createdAt, ID) cursor; the client never acknowledges a sidebar summary.
export function useConversationRead(conversationId: number, token: string | null,
  messages: ChatMessage[], loading: boolean, areaRef: RefObject<HTMLDivElement>,
  onReadState?: (state: ConversationReadState) => void) {
  const values = useRef({ messages, loading, onReadState });
  values.current = { messages, loading, onReadState };
  const active = useRef(true);
  const acknowledged = useRef<ChatMessage | null>(null);
  const pending = useRef<ChatMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const queued = useRef(false);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!active.current || !token || values.current.loading
        || document.visibilityState !== 'visible' || !document.hasFocus()
        || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const area = areaRef.current;
      if (!area || area.clientHeight <= 0) return;
      const viewport = area.getBoundingClientRect();
      const visibleTop = Math.max(viewport.top, 0);
      const visibleBottom = Math.min(viewport.bottom, window.innerHeight,
        window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight);
      if (viewport.height <= 0 || visibleBottom <= visibleTop) return;
      const byId = new Map(values.current.messages.map((message) => [message.messageId, message]));
      let boundary: ChatMessage | null = null;
      for (const row of area.querySelectorAll<HTMLElement>('[data-message-id]')) {
        const bounds = row.getBoundingClientRect();
        if (bounds.height <= 0 || bounds.bottom > visibleBottom || bounds.bottom <= visibleTop) continue;
        const message = byId.get(Number(row.dataset.messageId));
        if (message && (!boundary || compareMessageOrder(message, boundary) > 0)) boundary = message;
      }
      if (!boundary || (acknowledged.current && compareMessageOrder(boundary, acknowledged.current) <= 0)) return;
      if (pending.current) {
        queued.current = compareMessageOrder(boundary, pending.current) > 0;
        return;
      }
      const cursor = boundary;
      pending.current = cursor;
      void markConversationRead(conversationId, cursor.messageId, token).then((state) => {
        if (!active.current) return;
        acknowledged.current = cursor;
        values.current.onReadState?.(state);
      }).catch(() => {
        // Keep the authoritative badge; a later scroll/focus safely retries this idempotent cursor.
      }).finally(() => {
        pending.current = null;
        if (active.current && queued.current) { queued.current = false; schedule(); }
      });
    }, 240);
  }, [conversationId, token, areaRef]);

  useEffect(() => {
    active.current = true;
    const area = areaRef.current;
    area?.addEventListener('scroll', schedule);
    window.addEventListener('focus', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    document.addEventListener('focusin', schedule);
    return () => {
      active.current = false;
      clearTimeout(timer.current);
      area?.removeEventListener('scroll', schedule);
      window.removeEventListener('focus', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      document.removeEventListener('focusin', schedule);
    };
  }, [schedule, areaRef]);

  useEffect(() => {
    schedule();
    const area = areaRef.current;
    if (!area || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(schedule, { root: area, threshold: [0, 1] });
    area.querySelectorAll('[data-message-id]').forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [messages, loading, schedule, areaRef]);
}
