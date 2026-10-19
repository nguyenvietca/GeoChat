import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountLifecycleSection } from './AccountLifecycleSection';
import { AdminUsersPage } from './AdminUsersPage';
import { ReactivateAccountPage } from './ReactivateAccountPage';
import { GoogleReturnPage } from '../auth/GoogleReturnPage';
import { deactivateAccount, listAdminUsers, moderateAccount, reactivateAccount } from '../../api/accounts';
import { completeGoogle, googleConfig, googleConnections, startGoogleAccountAction } from '../../api/google';
import { ApiError } from '../../api/client';
import { openAdminConversation } from '../../api/admin';

const mocks = vi.hoisted(() => ({ logout: vi.fn(), accept: vi.fn(), navigate: vi.fn(), role: 'USER' }));
vi.mock('../../app/providers/AuthContext', () => ({ useAuth: () => ({ token: 'session', user: { id: 1, role: mocks.role }, logout: mocks.logout,
  acceptGoogleSession: mocks.accept, isLoading: false, login: vi.fn(), retrySessionRestore: vi.fn(), sessionNotice: '' }) }));
vi.mock('../../api/accounts', () => ({ deactivateAccount: vi.fn(), listAdminUsers: vi.fn(), moderateAccount: vi.fn(), reactivateAccount: vi.fn() }));
vi.mock('../../api/admin', () => ({ openAdminConversation: vi.fn() }));
vi.mock('../../api/google', () => ({ googleConfig: vi.fn(), googleConnections: vi.fn(), startGoogleAccountAction: vi.fn(), completeGoogle: vi.fn() }));
vi.mock('../auth/GoogleButton', () => ({ GoogleButton: () => null }));
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => mocks.navigate }));
const renderPage = (element: React.ReactNode) => render(<MemoryRouter>{element}</MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks(); mocks.role = 'USER'; localStorage.removeItem('geochat.web.language');
  vi.mocked(googleConfig).mockResolvedValue({ enabled: true });
  vi.mocked(googleConnections).mockResolvedValue({ passwordAvailable: true, googleConnected: false, email: null });
});

describe('Account lifecycle UI', () => {
  it('requires explicit confirmation and password, then signs out', async () => {
    vi.mocked(deactivateAccount).mockResolvedValue(null); renderPage(<AccountLifecycleSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate account' }));
    const input = await screen.findByLabelText('Confirm your current password');
    const submit = screen.getByRole('button', { name: 'Deactivate account' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Password123!' } });
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(submit);
    await waitFor(() => expect(deactivateAccount).toHaveBeenCalledWith('session', 'Password123!'));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/login', { replace: true, state: { deactivated: true } });
  });
  it('preserves session and shows error on rejected deactivation', async () => {
    vi.mocked(deactivateAccount).mockRejectedValue(new ApiError('Current password is incorrect.', 400)); renderPage(<AccountLifecycleSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate account' }));
    fireEvent.change(await screen.findByLabelText('Confirm your current password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Deactivate account' }));
    expect(await screen.findByRole('alert')).toBeTruthy(); expect(mocks.logout).not.toHaveBeenCalled();
  });
  it('uses Google proof for Google-only users', async () => {
    vi.mocked(googleConnections).mockResolvedValue({ passwordAvailable: false, googleConnected: true, email: 'own@example.com' });
    renderPage(<AccountLifecycleSection />); fireEvent.click(screen.getByRole('button', { name: 'Deactivate account' }));
    await screen.findByText(/Confirm using the Google account/);
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Deactivate account' }));
    await waitFor(() => expect(startGoogleAccountAction).toHaveBeenCalledWith('deactivate', 'session'));
    expect(deactivateAccount).not.toHaveBeenCalled(); expect(mocks.logout).not.toHaveBeenCalled();
  });
  it('requires confirmation after sign-in and exchanges the restricted session', async () => {
    vi.mocked(reactivateAccount).mockResolvedValue({ token: 'fresh', tokenType: 'Bearer' }); renderPage(<ReactivateAccountPage />);
    const activate = screen.getByRole('button', { name: 'Reactivate account' }) as HTMLButtonElement;
    expect(activate.disabled).toBe(true);
    expect(reactivateAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(activate);
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith('fresh'));
    expect(reactivateAccount).toHaveBeenCalledWith('session');
  });
  it('allows signing out instead of activating', () => {
    renderPage(<ReactivateAccountPage />); fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(mocks.logout).toHaveBeenCalledTimes(1); expect(reactivateAccount).not.toHaveBeenCalled();
  });
  it('signs out after Google deactivation without installing a token', async () => {
    vi.mocked(completeGoogle).mockResolvedValue({ token: null, linked: false, deactivated: true });
    renderPage(<GoogleReturnPage />);
    await waitFor(() => expect(mocks.logout).toHaveBeenCalled()); expect(mocks.accept).not.toHaveBeenCalled();
  });
  it('does not fetch admin data for regular users', () => {
    renderPage(<AdminUsersPage />); expect(listAdminUsers).not.toHaveBeenCalled();
  });
  it('lets a super administrator open a conversation from user management', async () => {
    mocks.role = 'SUPER_ADMIN';
    vi.mocked(listAdminUsers).mockResolvedValue({ items: [{ id: 2, username: 'alice', displayName: 'Alice', status: 'ACTIVE', role: 'USER', blockReason: null }], hasMore: false });
    vi.mocked(openAdminConversation).mockResolvedValue({ conversationId: 42 });
    renderPage(<AdminUsersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Message user' }));
    await waitFor(() => expect(openAdminConversation).toHaveBeenCalledWith('session', 2));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/chat/42');
  });
  it('requires a reason to unblock and refreshes status after success', async () => {
    mocks.role = 'ADMIN';
    vi.mocked(listAdminUsers).mockResolvedValue({ items: [{ id: 2, username: 'alice', displayName: 'Alice', status: 'LOCKED', role: 'USER', blockReason: 'Spam' }], hasMore: false });
    vi.mocked(moderateAccount).mockResolvedValue(null); renderPage(<AdminUsersPage />);
    const trigger = await screen.findByRole('button', { name: 'Unblock account' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Unblock account @alice' }).getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Reason'));
    fireEvent.keyDown(screen.getByLabelText('Reason'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(moderateAccount).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    const submit = screen.getByRole('button', { name: 'Confirm change' }) as HTMLButtonElement; expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Appeal accepted' } }); fireEvent.click(submit);
    await waitFor(() => expect(moderateAccount).toHaveBeenCalledWith('session', 2, false, 'Appeal accepted'));
    expect(await screen.findByRole('status')).toBeTruthy(); expect(listAdminUsers).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
