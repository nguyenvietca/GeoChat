import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationVerification } from './RegistrationVerification';
import { registrationConfig } from '../../api/auth';

vi.mock('../../api/auth', () => ({ registrationConfig: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); delete window.turnstile; });

describe('registration verification', () => {
  it('does not load third party code when disabled', async () => {
    vi.mocked(registrationConfig).mockResolvedValue({ enabled: false, siteKey: null });
    const change = vi.fn(); render(<RegistrationVerification onChange={change} resetKey={0} />);
    await waitFor(() => expect(change).toHaveBeenLastCalledWith({ pending: false, enabled: false, token: '' }));
    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
  });
  it('requires a token, clears expired tokens, and removes stale widgets on retry', async () => {
    vi.mocked(registrationConfig).mockResolvedValue({ enabled: true, siteKey: 'public-site-key' });
    let options: Record<string, unknown> = {};
    const remove = vi.fn();
    window.turnstile = { render: vi.fn((_node, config) => { options = config; return 'widget'; }), remove };
    const change = vi.fn(); const view = render(<RegistrationVerification onChange={change} resetKey={0} />);
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalled());
    expect(options.action).toBe('register');
    act(() => (options.callback as (value: string) => void)('one-use-token'));
    expect(change).toHaveBeenLastCalledWith({ pending: false, enabled: true, token: 'one-use-token' });
    act(() => (options['expired-callback'] as () => void)());
    expect(change).toHaveBeenLastCalledWith({ pending: false, enabled: true, token: '' });
    view.rerender(<RegistrationVerification onChange={change} resetKey={1} />);
    await waitFor(() => expect(remove).toHaveBeenCalledWith('widget'));
  });
  it('keeps registration blocked on config failure and allows retry', async () => {
    vi.mocked(registrationConfig).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ enabled: false, siteKey: null });
    const change = vi.fn(); render(<RegistrationVerification onChange={change} resetKey={0} />);
    expect(await screen.findByRole('alert')).not.toBeNull();
    expect(change).toHaveBeenLastCalledWith({ pending: true, enabled: false, token: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
    await waitFor(() => expect(change).toHaveBeenLastCalledWith({ pending: false, enabled: false, token: '' }));
  });
});
