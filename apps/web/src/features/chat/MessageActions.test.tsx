import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageActions } from './MessageActions';
import { ChatMessage } from '../../types';

const message: ChatMessage = { messageId: 4, conversationId: 41, senderId: 22, content: '<b>plain text</b>', createdAt: '2026-10-10T10:00:00Z',
  reactions: [{ emoji: '👍', count: 2, reactedByMe: true }] };

describe('message actions', () => {
  it('opens reactions directly from the icon and keeps the three-dot actions menu', () => {
    const reply = vi.fn();
    render(<MessageActions message={message} busy={false} onReply={reply} onReact={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reply to message 4' }));
    expect(reply).toHaveBeenCalledOnce();
    const reactionTrigger = screen.getByRole('button', { name: 'React to message 4' });
    fireEvent.click(reactionTrigger);
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(6);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.activeElement).toBe(reactionTrigger);
    fireEvent.click(screen.getByRole('button', { name: 'Actions for message 4' }));
    expect(screen.getByRole('menuitem', { name: 'Reply' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'React' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Copy text' })).toBeTruthy();
  });

  it('opens below a message near the clipped top of the chat', () => {
    const geometry = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const top = this.classList.contains('chat-message-area') ? 250 : 300;
      return { top, bottom: top + 160, height: 160, left: 0, right: 200, width: 200, x: 0, y: top, toJSON: () => ({}) };
    });
    try {
      render(<div className="chat-message-area"><MessageActions message={message} busy={false} onReply={vi.fn()} onReact={vi.fn()} /></div>);
      fireEvent.click(screen.getByRole('button', { name: 'Actions for message 4' }));
      expect(screen.getByRole('menu').classList.contains('below')).toBe(true);
    } finally { geometry.mockRestore(); }
  });

  it('opens on click, focuses actions, navigates with arrows and closes with Escape', () => {
    render(<MessageActions message={message} busy={false} onReply={vi.fn()} onReact={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Actions for message 4' });
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Reply' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'React' }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Copy text' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole('menuitem', { name: /Delete|Edit/ })).toBeNull();
  });

  it('dismisses outside, replies, and toggles selected picker and badge reactions', () => {
    const reply = vi.fn(), react = vi.fn();
    render(<MessageActions message={message} busy={false} onReply={reply} onReact={react} />);
    const trigger = screen.getByRole('button', { name: 'Actions for message 4' });
    fireEvent.click(trigger); fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger); fireEvent.click(screen.getByRole('menuitem', { name: 'Reply' }));
    expect(reply).toHaveBeenCalledOnce();
    fireEvent.click(trigger); fireEvent.click(screen.getByRole('menuitem', { name: 'React' }));
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(6);
    const selected = screen.getByRole('menuitemcheckbox', { name: 'Thumbs up' });
    expect(selected.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(selected);
    expect(react).toHaveBeenCalledWith('thumbs-up', false);
    fireEvent.click(screen.getByRole('button', { name: 'Thumbs up: 2, reacted by you' }));
    expect(react).toHaveBeenCalledTimes(2);
    fireEvent.click(trigger); fireEvent.click(screen.getByRole('menuitem', { name: 'React' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Heart' }));
    expect(react).toHaveBeenLastCalledWith('heart', true);
  });

  it('copies only text and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<MessageActions message={message} busy={false} onReply={vi.fn()} onReact={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions for message 4' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy text' }));
    expect(writeText).toHaveBeenCalledWith('<b>plain text</b>');
    await screen.findByText('Text copied.');
  });

  it('reports denied and unsupported clipboard without crashing', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<MessageActions message={message} busy={false} onReply={vi.fn()} onReact={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Actions for message 4' });
    fireEvent.click(trigger); fireEvent.click(screen.getByRole('menuitem', { name: 'Copy text' }));
    await screen.findByText('Could not copy. Select the message text to copy it.');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    fireEvent.click(trigger); fireEvent.click(screen.getByRole('menuitem', { name: 'Copy text' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Copy is unavailable'));
  });
});
