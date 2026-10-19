import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { PasswordRecoveryPage } from './PasswordRecoveryPage';
import { passwordRecoveryConfig, requestPasswordReset, resetPassword } from '../../api/password';

vi.mock('../../api/password', () => ({ passwordRecoveryConfig: vi.fn(), requestPasswordReset: vi.fn(), resetPassword: vi.fn() }));
vi.mock('../../app/providers/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
beforeEach(() => { vi.resetAllMocks(); vi.mocked(passwordRecoveryConfig).mockResolvedValue({ enabled: true }); });

it('requests an email link and displays a neutral response', async () => {
  vi.mocked(requestPasswordReset).mockResolvedValue(null);
  render(<MemoryRouter><PasswordRecoveryPage mode="forgot" /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'alice@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect((await screen.findByRole('status')).textContent).toContain('If this email belongs to an eligible account');
  expect(requestPasswordReset).toHaveBeenCalledWith('alice@example.com');
});
it('removes the link token from the URL and requires matching passwords', async () => {
  const token = 'a'.repeat(43); window.history.replaceState({}, '', `/reset-password#token=${token}`);
  vi.mocked(resetPassword).mockResolvedValue(null);
  render(<MemoryRouter><PasswordRecoveryPage mode="reset" /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'NewPassword123!' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Different123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  expect((await screen.findByRole('alert')).textContent).toContain('do not match'); expect(resetPassword).not.toHaveBeenCalled();
  expect(window.location.hash).toBe('');
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPassword123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  await waitFor(() => expect(resetPassword).toHaveBeenCalledWith(token, 'NewPassword123!'));
  expect((await screen.findByRole('status')).textContent).toContain('Password updated');
});
it('rejects a missing reset link', async () => {
  render(<MemoryRouter><PasswordRecoveryPage mode="reset" /></MemoryRouter>);
  expect((await screen.findByRole('alert')).textContent).toContain('invalid or expired');
  expect(screen.queryByLabelText('New password')).toBeNull();
});
it('hides the recovery form when SMTP recovery is disabled', async () => {
  vi.mocked(passwordRecoveryConfig).mockResolvedValue({ enabled: false });
  render(<MemoryRouter><PasswordRecoveryPage mode="forgot" /></MemoryRouter>);
  expect((await screen.findByRole('status')).textContent).toContain('currently unavailable');
  expect(screen.queryByLabelText('Email')).toBeNull(); expect(requestPasswordReset).not.toHaveBeenCalled();
});
