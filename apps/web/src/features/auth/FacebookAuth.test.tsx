import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FacebookButton } from './FacebookButton';
import { GoogleButton } from './GoogleButton';
import { GoogleReturnPage } from './GoogleReturnPage';
import { FacebookAccount } from '../settings/FacebookAccount';
import { completeFacebook, facebookConfig, facebookConnections, reauthenticateProvider, redirectProvider, startFacebook, unlinkFacebook } from '../../api/facebook';
import { googleConfig } from '../../api/google';
import { ApiError } from '../../api/client';

const mocks = vi.hoisted(() => ({ accept: vi.fn(), navigate: vi.fn() }));
vi.mock('../../api/facebook', () => ({ facebookConfig: vi.fn(), facebookConnections: vi.fn(), completeFacebook: vi.fn(), startFacebook: vi.fn(), unlinkFacebook: vi.fn(), reauthenticateProvider: vi.fn(), redirectProvider: vi.fn() }));
vi.mock('../../api/google', () => ({ googleConfig: vi.fn(), startGoogle: vi.fn(), completeGoogle: vi.fn() }));
vi.mock('../../app/providers/AuthContext', () => ({ useAuth: () => ({ token: 'session', isLoading: false, acceptGoogleSession: mocks.accept }) }));
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => mocks.navigate }));
beforeEach(() => { vi.resetAllMocks(); window.history.replaceState({}, '', '/oauth/complete?provider=facebook'); });

describe('Facebook login', () => {
  it('hides Facebook when disabled', async () => {
    vi.mocked(facebookConfig).mockResolvedValue({ enabled: false }); render(<FacebookButton />);
    await waitFor(() => expect(facebookConfig).toHaveBeenCalled()); expect(screen.queryByRole('button')).toBeNull();
  });
  it('keeps Google visible and exposes accessible Facebook loading state', async () => {
    vi.mocked(facebookConfig).mockResolvedValue({ enabled: true }); vi.mocked(googleConfig).mockResolvedValue({ enabled: true });
    vi.mocked(startFacebook).mockReturnValue(new Promise(() => {}));
    render(<><GoogleButton /><FacebookButton /></>);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Facebook' }));
    expect((screen.getByRole('button', { name: 'Redirecting to Facebook…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeDefined();
  });
  it('reports safe provider errors and permits retry', async () => {
    vi.mocked(facebookConfig).mockResolvedValue({ enabled: true }); vi.mocked(startFacebook).mockRejectedValue(new Error('private'));
    render(<FacebookButton />); fireEvent.click(await screen.findByRole('button'));
    expect((await screen.findByRole('alert')).textContent).toContain('temporarily unavailable');
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });
  it('redeems Facebook once using existing application session installation', async () => {
    vi.mocked(completeFacebook).mockResolvedValue({ token: 'application-jwt', linked: false });
    render(<MemoryRouter><GoogleReturnPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith('application-jwt'));
    expect(completeFacebook).toHaveBeenCalledTimes(1); expect(window.location.search).toBe('');
  });
  it('continues provider linking after verifying the existing provider', async () => {
    vi.mocked(completeFacebook).mockResolvedValue({ token: null, linked: false, nextUrl: '/api/oauth2/authorization/google' });
    render(<MemoryRouter><GoogleReturnPage /></MemoryRouter>);
    await waitFor(() => expect(redirectProvider).toHaveBeenCalledWith('/api/oauth2/authorization/google'));
    expect(mocks.accept).not.toHaveBeenCalled();
  });
  it('reports completion errors without accepting a session', async () => {
    vi.mocked(completeFacebook).mockRejectedValue(new ApiError('Sign in using your existing method, then connect the provider in Settings.', 400));
    render(<MemoryRouter><GoogleReturnPage /></MemoryRouter>);
    expect((await screen.findByRole('alert')).textContent).toContain('existing method'); expect(mocks.accept).not.toHaveBeenCalled();
  });
});

describe('Facebook account settings', () => {
  const available = vi.fn();
  function setup(connected: boolean, passwordAvailable = true, googleAvailable = true) {
    vi.mocked(facebookConfig).mockResolvedValue({ enabled: true });
    vi.mocked(facebookConnections).mockResolvedValue({ passwordAvailable, facebookConnected: connected, email: connected ? 'own@example.com' : null });
    render(<FacebookAccount token="session" googleAvailable={googleAvailable} onAvailable={available} />);
  }
  it('connects only after password confirmation', async () => {
    setup(false); const button = await screen.findByRole('button', { name: 'Connect Facebook' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Confirm your current password for Facebook'), { target: { value: 'Password123!' } });
    fireEvent.click(button); await waitFor(() => expect(startFacebook).toHaveBeenCalledWith('session', 'Password123!'));
  });
  it('disconnects and refreshes connection status', async () => {
    setup(true); const button = await screen.findByRole('button', { name: 'Disconnect Facebook' });
    expect(screen.getByText('own@example.com')).toBeDefined();
    vi.mocked(facebookConnections).mockResolvedValue({ passwordAvailable: true, facebookConnected: false, email: null });
    fireEvent.change(screen.getByLabelText('Confirm your current password for Facebook'), { target: { value: 'Password123!' } });
    fireEvent.click(button); await waitFor(() => expect(unlinkFacebook).toHaveBeenCalledWith('session', 'Password123!'));
    expect(await screen.findByText(/Facebook disconnected/)).toBeDefined();
  });
  it('confirms connected Google for passwordless users', async () => {
    setup(false, false); fireEvent.click(await screen.findByRole('button', { name: 'Connect Facebook' }));
    await waitFor(() => expect(reauthenticateProvider).toHaveBeenCalledWith('google', 'link', 'session'));
  });
  it('protects the last sign-in method', async () => {
    setup(true, false, false); await screen.findByText('own@example.com');
    expect(screen.queryByRole('button', { name: 'Disconnect Facebook' })).toBeNull();
    expect(screen.getByText(/Keep at least one usable/)).toBeDefined();
  });
});
