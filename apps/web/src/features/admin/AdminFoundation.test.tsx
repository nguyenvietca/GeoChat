import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AdminLayout } from './AdminLayout';
import { AdminAuditPage } from './AdminAuditPage';
import { AdminUserDetail } from './AdminUserDetail';
import { AdminUsersPage } from '../settings/AdminUsersPage';
import { AdminDecision } from './AdminDecision';
import { getCurrentUser } from '../../api/auth';
import { getAdminAudit, getAdminUser } from '../../api/admin';
import { listAdminUsers, moderateAccount } from '../../api/accounts';
import { ApiError } from '../../api/client';
const auth = vi.hoisted(() => ({ role: 'ADMIN', token: 'admin-session' as string | null }));
vi.mock('../../app/providers/AuthContext', () => ({ useAuth: () => ({ token: auth.token, user: { id: 1, status: 'ACTIVE', role: auth.role, displayName: 'Operator' }, isLoading: false, isAuthenticated: !!auth.token, logout: vi.fn() }) }));
vi.mock('../../api/auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('../../api/admin', () => ({ getAdminAudit: vi.fn(), getAdminUser: vi.fn(), openAdminConversation: vi.fn() }));
vi.mock('../../api/accounts', () => ({ listAdminUsers: vi.fn(), moderateAccount: vi.fn() }));
const user = { id: 2, username: 'alice', displayName: 'Alice', status: 'ACTIVE', role: 'USER', blockReason: null, email: 'alice@example.com', createdAt: '2026-10-01T00:00:00Z', providers: ['GOOGLE','FACEBOOK'] };
const row = { id: 1, actorId: 1, actor: 'Operator', targetId: 2, target: 'alice', action: 'BLOCK', reason: 'Spam', createdAt: '2026-10-01T00:00:00Z', previousStatus: 'ACTIVE', newStatus: 'LOCKED', previousRole: null, newRole: null };
beforeEach(() => { vi.resetAllMocks(); auth.role = 'ADMIN'; auth.token = 'admin-session'; vi.mocked(getCurrentUser).mockResolvedValue({ ...user, role: 'ADMIN' }); });
function page(element: React.ReactNode) { return render(<MemoryRouter>{element}</MemoryRouter>); }
it('verifies current server privileges before rendering protected content', async () => {
  let resolve!: (value: typeof user) => void;
  vi.mocked(getCurrentUser).mockReturnValue(new Promise(done => { resolve = done as typeof resolve; }));
  render(<MemoryRouter initialEntries={['/admin']}><Routes><Route path="/admin" element={<AdminLayout />}><Route index element={<h1>Protected records</h1>} /></Route></Routes></MemoryRouter>);
  expect(screen.queryByText('Protected records')).toBeNull();
  resolve({ ...user, role: 'ADMIN' }); expect(await screen.findByText('Protected records')).toBeDefined();
});
it('does not fetch admin records for ordinary users', () => {
  auth.role = 'USER'; page(<AdminUsersPage />); expect(listAdminUsers).not.toHaveBeenCalled();
});
it('shows a safe permission error when server authority verification fails', async () => {
  vi.mocked(getCurrentUser).mockRejectedValue(new ApiError('Expired session',401)); page(<AdminLayout />);
  expect((await screen.findByRole('alert')).textContent).toContain('could not be verified');
});
it('queries the server for search/status/provider and stable next pages', async () => {
  vi.mocked(listAdminUsers).mockResolvedValue({ items: [user], hasMore: true }); page(<AdminUsersPage />);
  await screen.findByText('alice@example.com');
  fireEvent.change(screen.getByLabelText('Search by username, email or display name'), { target: { value: 'alice' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith('admin-session','alice',0,expect.anything(),expect.anything()));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'LOCKED' } });
  await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith('admin-session','alice',0,expect.objectContaining({ status: 'LOCKED' }),expect.anything()));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith('admin-session','alice',1,expect.anything(),expect.anything()));
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith('admin-session','',0, { status: '', provider: '', after: '', before: '' },expect.anything()));
  expect((screen.getByLabelText('Search by username, email or display name') as HTMLInputElement).value).toBe('');
});
it('loads read-only user details and recent audit without secrets or chats', async () => {
  vi.mocked(getAdminUser).mockResolvedValue({ user, history: [row] });
  render(<MemoryRouter initialEntries={['/admin/users/2']}><Routes><Route path="/admin/users/:userId" element={<AdminUserDetail />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('alice@example.com')).toBeDefined(); expect(screen.getByText('GOOGLE, FACEBOOK')).toBeDefined(); expect(screen.getByText('Spam')).toBeDefined();
  expect(screen.queryByText(/passwordHash|latitude|private message/)).toBeNull();
});
it('requires a nonblank reason and prevents duplicate suspension submissions', async () => {
  vi.mocked(moderateAccount).mockReturnValue(new Promise(() => {})); page(<AdminDecision token="admin-session" user={user} onDone={vi.fn()} />);
  fireEvent.click(screen.getByRole('button')); const confirm = screen.getByRole('button', { name: 'Confirm change' }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true); fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Spam' } }); fireEvent.click(confirm); fireEvent.click(confirm);
  expect(moderateAccount).toHaveBeenCalledTimes(1); expect(moderateAccount).toHaveBeenCalledWith('admin-session',2,true,'Spam');
});
it('reactivates with a reason and reports server conflicts', async () => {
  vi.mocked(moderateAccount).mockRejectedValue(new ApiError('Account changed. Refresh.',409));
  page(<AdminDecision token="admin-session" user={{ ...user, status: 'LOCKED' }} onDone={vi.fn()} />);
  fireEvent.click(screen.getByRole('button')); fireEvent.change(screen.getByLabelText('Reason'),{target:{value:'Appeal'}}); fireEvent.click(screen.getByRole('button',{name:'Confirm change'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Account changed'); expect(moderateAccount).toHaveBeenCalledWith('admin-session',2,false,'Appeal');
});
it('filters paginated audit and presents readable actor/action/reason', async () => {
  vi.mocked(getAdminAudit).mockResolvedValue({ items: [row], hasMore: true }); page(<AdminAuditPage />);
  expect(await screen.findByText('Spam')).toBeDefined();
  fireEvent.change(screen.getByLabelText('Action'),{target:{value:'BLOCK'}}); fireEvent.click(screen.getByRole('button',{name:'Search'}));
  await waitFor(()=>expect(getAdminAudit).toHaveBeenLastCalledWith('admin-session',expect.objectContaining({action:'BLOCK',page:'0'}),expect.anything()));
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  await waitFor(()=>expect(getAdminAudit).toHaveBeenLastCalledWith('admin-session',expect.objectContaining({page:'1'}),expect.anything()));
  fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));
  await waitFor(()=>expect(getAdminAudit).toHaveBeenLastCalledWith('admin-session',{page:'0'},expect.anything()));
  expect((screen.getByLabelText('Action') as HTMLSelectElement).value).toBe('');
});
