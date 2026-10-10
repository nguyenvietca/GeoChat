import { act, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markConversationRead } from '../../api/chats';
import { ChatMessage, ConversationReadState } from '../../types';
import { useConversationRead } from './useConversationRead';

vi.mock('../../api/chats', () => ({ markConversationRead: vi.fn() }));
const message = (id: number): ChatMessage => ({ messageId: id, conversationId: 41, senderId: 22, content: `Message ${id}`, createdAt: `2026-10-10T12:00:${String(id).padStart(2, '0')}Z` });
function Harness({ messages, onRead }: { messages: ChatMessage[]; onRead: (state: ConversationReadState) => void }) {
  const area = useRef<HTMLDivElement>(null);
  useConversationRead(41, 'jwt', messages, false, area, onRead);
  return <div ref={area} data-testid="area">{messages.map((item) => <div data-message-id={item.messageId} key={item.messageId}>{item.content}</div>)}</div>;
}
function geometry(container: HTMLElement, visibleId: number) {
  const area = container.firstElementChild as HTMLDivElement;
  Object.defineProperty(area, 'clientHeight', { configurable: true, value: 200 });
  area.getBoundingClientRect = () => ({ top: 0, bottom: 200, height: 200 }) as DOMRect;
  area.querySelectorAll<HTMLElement>('[data-message-id]').forEach((row) => {
    const visible = Number(row.dataset.messageId) <= visibleId;
    row.getBoundingClientRect = () => ({ top: visible ? 10 : 300, bottom: visible ? 40 : 340, height: 30 }) as DOMRect;
  });
  return area;
}
async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(260); }); }

describe('viewed message read boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.mocked(markConversationRead).mockResolvedValue({ conversationId: 41, unreadCount: 0, readStateVersion: 2 });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('acknowledges only the last viewed message and debounces repeated scrolling', async () => {
    const onRead = vi.fn();
    const view = render(<Harness messages={[message(1), message(2)]} onRead={onRead} />);
    const area = geometry(view.container, 2);
    fireEvent.scroll(area); fireEvent.scroll(area);
    await flush();
    expect(markConversationRead).toHaveBeenCalledOnce();
    expect(markConversationRead).toHaveBeenCalledWith(41, 2, 'jwt');
    expect(onRead).toHaveBeenCalledWith({ conversationId: 41, unreadCount: 0, readStateVersion: 2 });
    fireEvent.scroll(area);
    await flush();
    expect(markConversationRead).toHaveBeenCalledOnce();
  });

  it('never acknowledges while hidden or unfocused, then acknowledges on return', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const focused = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const view = render(<Harness messages={[message(1)]} onRead={vi.fn()} />);
    geometry(view.container, 1);
    await flush();
    expect(markConversationRead).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    await flush();
    expect(markConversationRead).not.toHaveBeenCalled();
    focused.mockReturnValue(true);
    fireEvent(window, new Event('focus'));
    await flush();
    expect(markConversationRead).toHaveBeenCalledOnce();
  });

  it('does not acknowledge a chat pane that is outside the browser viewport', async () => {
    const view = render(<Harness messages={[message(1)]} onRead={vi.fn()} />);
    const area = geometry(view.container, 1);
    area.getBoundingClientRect = () => ({ top: 1000, bottom: 1200, height: 200 }) as DOMRect;
    await flush();
    expect(markConversationRead).not.toHaveBeenCalled();
  });

  it('does not acknowledge offscreen new messages when reading older history', async () => {
    const onRead = vi.fn();
    const view = render(<Harness messages={[message(1), message(2)]} onRead={onRead} />);
    geometry(view.container, 1);
    await flush();
    expect(markConversationRead).toHaveBeenLastCalledWith(41, 1, 'jwt');
    view.rerender(<Harness messages={[message(1), message(2), message(3)]} onRead={onRead} />);
    let area = geometry(view.container, 1);
    await flush();
    expect(markConversationRead).toHaveBeenCalledOnce();
    area = geometry(view.container, 3);
    fireEvent.scroll(area);
    await flush();
    expect(markConversationRead).toHaveBeenLastCalledWith(41, 3, 'jwt');
  });

  it('keeps server state on failure and retries safely on another viewing interaction', async () => {
    const onRead = vi.fn();
    vi.mocked(markConversationRead).mockRejectedValueOnce(new Error('Network'));
    const view = render(<Harness messages={[message(1)]} onRead={onRead} />);
    const area = geometry(view.container, 1);
    await flush();
    expect(onRead).not.toHaveBeenCalled();
    await flush();
    expect(markConversationRead).toHaveBeenCalledOnce();
    fireEvent.scroll(area);
    await flush();
    expect(markConversationRead).toHaveBeenCalledTimes(2);
    expect(onRead).toHaveBeenCalledOnce();
  });

  it('cancels a pending boundary on switching conversations and ignores late responses', async () => {
    const onRead = vi.fn();
    let resolve!: (state: ConversationReadState) => void;
    vi.mocked(markConversationRead).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const view = render(<Harness messages={[message(1)]} onRead={onRead} />);
    geometry(view.container, 1);
    await flush();
    view.unmount();
    await act(async () => resolve({ conversationId: 41, unreadCount: 0, readStateVersion: 2 }));
    expect(onRead).not.toHaveBeenCalled();
    const second = render(<Harness messages={[message(1)]} onRead={onRead} />);
    geometry(second.container, 1);
    second.unmount();
    await flush();
    expect(markConversationRead).toHaveBeenCalledOnce();
  });
});
